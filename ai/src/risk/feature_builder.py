from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class RiskInputFeatures:
    batch_id: Optional[int]
    stage: str
    weather_temp: float
    weather_humidity: float
    weather_condition: str
    rainy_days_3d: int
    weather_summary: str
    recent_disease_count: int
    recent_high_disease_count: int
    latest_disease_confidence: Optional[float]
    disease_summary: str
    farming_actions: List[str]
    days_without_irrigation: int
    has_recent_pesticide: bool
    history_high_risk_count_30d: int


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _pick(obj: Dict[str, Any], keys: List[str], default: Any = None) -> Any:
    for key in keys:
        if key in obj and obj[key] is not None:
            return obj[key]
    return default


def _count_rainy_days(forecast: List[Dict[str, Any]]) -> int:
    rainy = 0
    for item in forecast[:3]:
        condition = str(item.get("condition", item.get("text", ""))).lower()
        icon = str(item.get("icon", "")).lower()
        if "rain" in condition or "雨" in condition or "rain" in icon:
            rainy += 1
    return rainy


def _normalize_forecast(weather: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = _pick(weather, ["forecast", "forecastData", "days"], default=[])
    if not isinstance(raw, list):
        return []
    return [x for x in raw if isinstance(x, dict)]


def _days_since(iso_or_datetime: Any) -> Optional[int]:
    if iso_or_datetime is None:
        return None

    if isinstance(iso_or_datetime, datetime):
        dt = iso_or_datetime
    else:
        text = str(iso_or_datetime).strip()
        if not text:
            return None
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    return max(0, int((now - dt).total_seconds() // 86400))


def _extract_farming_actions(farming: Dict[str, Any], logs: Any) -> List[str]:
    actions: List[str] = []

    if isinstance(logs, list):
        for item in logs[:10]:
            if isinstance(item, dict):
                value = str(item.get("type", item.get("action", ""))).strip().lower()
                if value:
                    actions.append(value)

    for key in ["latest_action", "latestAction", "last_operation", "lastOperation"]:
        value = farming.get(key)
        if value:
            actions.append(str(value).strip().lower())

    uniq = list(dict.fromkeys(actions))
    return uniq


def _summarize_weather(temp: float, humidity: float, rainy_days_3d: int, condition: str) -> str:
    parts = [f"气温{temp:.1f}℃", f"湿度{humidity:.1f}%", f"未来3天降雨{rainy_days_3d}天"]
    if condition:
        parts.append(f"当前天气{condition}")
    return "，".join(parts)


def _summarize_disease(recent_count: int, high_count: int, latest_conf: Optional[float]) -> str:
    text = f"近7天病害记录{recent_count}条，高风险{high_count}条"
    if latest_conf is not None:
        text += f"，最新识别置信度{latest_conf:.2f}"
    return text


def build_risk_features(payload: Dict[str, Any]) -> RiskInputFeatures:
    batch = payload.get("batch", {}) if isinstance(payload.get("batch"), dict) else {}
    weather = payload.get("weather", {}) if isinstance(payload.get("weather"), dict) else {}
    disease = payload.get("disease", {}) if isinstance(payload.get("disease"), dict) else {}
    farming = payload.get("farming", {}) if isinstance(payload.get("farming"), dict) else {}
    history = payload.get("history", {}) if isinstance(payload.get("history"), dict) else {}

    forecast = _normalize_forecast(weather)
    rainy_days_3d = _count_rainy_days(forecast)

    temp = _to_float(_pick(weather, ["temp", "temperature", "currentTemp"], 0.0))
    humidity = _to_float(_pick(weather, ["humidity", "relativeHumidity"], 0.0))
    condition = str(_pick(weather, ["condition", "text", "weatherText"], "")).strip()

    recent_disease_count = _to_int(
        _pick(disease, ["recent_disease_count", "recentDiseaseCount", "count7d"], 0)
    )
    recent_high_disease_count = _to_int(
        _pick(disease, ["recent_high_disease_count", "recentHighDiseaseCount", "highCount7d"], 0)
    )

    latest_conf_raw = _pick(disease, ["latest_confidence", "latestDiseaseConfidence", "latestConfidence"], None)
    latest_conf = None if latest_conf_raw is None else _to_float(latest_conf_raw)

    logs = payload.get("logs", payload.get("farmingLogs", []))
    farming_actions = _extract_farming_actions(farming=farming, logs=logs)

    days_without_irrigation = _to_int(
        _pick(farming, ["days_without_irrigation", "daysWithoutIrrigation"], -1)
    )
    if days_without_irrigation < 0:
        last_irrigation_at = _pick(farming, ["latest_irrigation_at", "latestIrrigationAt"], None)
        since_days = _days_since(last_irrigation_at)
        days_without_irrigation = since_days if since_days is not None else 99

    has_recent_pesticide = any(x in farming_actions for x in ["pesticide", "spray", "喷药"])

    history_high_risk_count_30d = _to_int(
        _pick(history, ["high_risk_count_30d", "highRiskCount30d"], 0)
    )

    stage = str(_pick(batch, ["stage", "growthStage"], payload.get("stage", ""))).strip()
    batch_id_raw = _pick(batch, ["batch_id", "batchId", "id"], payload.get("batchId"))
    batch_id = None if batch_id_raw is None else _to_int(batch_id_raw)

    weather_summary = _summarize_weather(temp=temp, humidity=humidity, rainy_days_3d=rainy_days_3d, condition=condition)
    disease_summary = _summarize_disease(
        recent_count=recent_disease_count,
        high_count=recent_high_disease_count,
        latest_conf=latest_conf,
    )

    return RiskInputFeatures(
        batch_id=batch_id,
        stage=stage,
        weather_temp=temp,
        weather_humidity=humidity,
        weather_condition=condition,
        rainy_days_3d=rainy_days_3d,
        weather_summary=weather_summary,
        recent_disease_count=recent_disease_count,
        recent_high_disease_count=recent_high_disease_count,
        latest_disease_confidence=latest_conf,
        disease_summary=disease_summary,
        farming_actions=farming_actions,
        days_without_irrigation=days_without_irrigation,
        has_recent_pesticide=has_recent_pesticide,
        history_high_risk_count_30d=history_high_risk_count_30d,
    )


# TODO: 后续补充土壤水势、叶面湿度、虫情灯等时序特征。
