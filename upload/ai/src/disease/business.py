from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional


SEVERITY_BY_LABEL: Dict[str, str] = {
    "normal": "low",
    "healthy": "low",
    "canker": "high",
    "anthracnose": "mid",
    "mite": "mid",
    "black_spot": "mid",
    "greening": "high",
    "melanose": "mid",
}

ADVICE_BY_LABEL: Dict[str, str] = {
    "normal": "暂未发现明显病害迹象，建议维持常规巡园并在7天内复拍确认。",
    "healthy": "暂未发现明显病害迹象，建议维持常规巡园并在7天内复拍确认。",
    "canker": "疑似柑橘溃疡病，建议48小时内人工复核病斑并按当地规范开展防治。",
    "anthracnose": "疑似炭疽相关症状，建议排查高湿区并在2-3天内复查病斑变化。",
    "mite": "疑似螨害风险，建议尽快检查叶背虫口密度并实施分区处理。",
    "black_spot": "疑似黑斑相关症状，建议尽快复核病斑并按当地规范开展分区防治。",
    "greening": "疑似黄龙病相关症状，建议48小时内人工复核并按当地检疫与防控要求处置。",
    "melanose": "疑似黑点病（Melanose）症状，建议结合田间湿度与传播风险尽快复核处理。",
}

LABEL_ALIASES: Dict[str, str] = {
    "healthy": "normal",
}


@dataclass
class DiseaseBusinessResult:
    label: str
    confidence: float
    severity: str
    advice: str
    needManualReview: bool
    narrative: str


def _canonical_label(label: str) -> str:
    normalized = str(label or "").strip().lower()
    return LABEL_ALIASES.get(normalized, normalized)


def infer_severity(label: str, confidence: float) -> str:
    canonical = _canonical_label(label)
    base = SEVERITY_BY_LABEL.get(canonical, "mid")
    if confidence < 0.55:
        return "unknown"
    if base == "high" and confidence < 0.75:
        return "mid"
    return base


def infer_need_manual_review(label: str, confidence: float, severity: str) -> bool:
    canonical = _canonical_label(label)
    if confidence < 0.65:
        return True
    if severity in {"high", "unknown"}:
        return True
    if canonical not in SEVERITY_BY_LABEL:
        return True
    return False


def build_rule_advice(label: str, confidence: float, severity: str, need_manual_review: bool) -> str:
    canonical = _canonical_label(label)
    advice = ADVICE_BY_LABEL.get(canonical, "识别结果暂无法明确，请结合现场情况进行人工诊断。")

    if confidence < 0.65:
        advice = (
            "当前识别置信度较低，结论不确定，仅供参考。"
            "建议在光线稳定条件下重拍，并尽快由农技人员复核。"
        )

    if need_manual_review and confidence >= 0.65:
        advice += " 建议尽快安排人工复核，避免延误处理时机。"

    if severity == "low" and canonical == "normal" and confidence >= 0.8:
        advice = "当前未见明显异常，建议继续常规巡检并留存影像记录。"

    return advice


def build_rule_narrative(
    label: str,
    confidence: float,
    severity: str,
    need_manual_review: bool,
    advice: str,
    crop_type: Optional[str] = None,
    growth_stage: Optional[str] = None,
    weather: Optional[str] = None,
    region: Optional[str] = None,
) -> str:
    crop_text = crop_type or "作物"
    stage_text = growth_stage or "当前生育期"
    weather_text = weather or "天气信息未提供"
    region_text = region or "区域未提供"

    uncertainty = "结论不确定，仅供参考。" if confidence < 0.65 else ""
    review_text = "建议尽快人工复核。" if need_manual_review else "可先按常规管理继续观察。"

    return (
        f"系统判断{crop_text}疑似{label}，置信度{confidence:.2f}，风险级别{severity}。"
        f"{uncertainty}{review_text}"
        f"当前阶段：{stage_text}；天气：{weather_text}；区域：{region_text}。"
        f"建议：{advice}"
    )


def to_business_result(
    label: str,
    confidence: float,
    crop_type: Optional[str] = None,
    growth_stage: Optional[str] = None,
    weather: Optional[str] = None,
    region: Optional[str] = None,
) -> DiseaseBusinessResult:
    severity = infer_severity(label=label, confidence=confidence)
    need_manual_review = infer_need_manual_review(label=label, confidence=confidence, severity=severity)
    advice = build_rule_advice(
        label=label,
        confidence=confidence,
        severity=severity,
        need_manual_review=need_manual_review,
    )
    narrative = build_rule_narrative(
        label=label,
        confidence=confidence,
        severity=severity,
        need_manual_review=need_manual_review,
        advice=advice,
        crop_type=crop_type,
        growth_stage=growth_stage,
        weather=weather,
        region=region,
    )
    return DiseaseBusinessResult(
        label=label,
        confidence=confidence,
        severity=severity,
        advice=advice,
        needManualReview=need_manual_review,
        narrative=narrative,
    )


# TODO: 后续把 severity/advice 规则迁移到配置中心支持动态更新。
