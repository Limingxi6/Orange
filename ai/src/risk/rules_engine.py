from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .feature_builder import RiskInputFeatures


LEVEL_TEXT_MAP = {
    "high": "高",
    "mid": "中",
    "low": "低",
}


@dataclass
class RuleHit:
    code: str
    title: str
    level: str
    score: int
    reason: str
    evidence: Dict[str, object] = field(default_factory=dict)


@dataclass
class RiskRuleResult:
    level: str
    level_text: str
    score: int
    hits: List[RuleHit]
    reason: str
    suggestion: str
    suggestions: List[str]


def evaluate_rules(features: RiskInputFeatures) -> RiskRuleResult:
    hits: List[RuleHit] = []
    suggestions: List[str] = []

    _apply_weather_humidity_rule(features, hits, suggestions)
    _apply_heat_drought_rule(features, hits, suggestions)
    _apply_disease_history_rule(features, hits, suggestions)
    _apply_stage_sensitive_rule(features, hits, suggestions)
    _apply_history_rule(features, hits, suggestions)

    if not hits:
        hits.append(
            RuleHit(
                code="baseline-low",
                title="基础风险",
                level="low",
                score=10,
                reason="未触发明显异常规则，当前按常规风险处理。",
                evidence={"weather": features.weather_summary, "disease": features.disease_summary},
            )
        )
        suggestions.append("保持常规巡园和周度复查节奏。")

    score = int(sum(hit.score for hit in hits))
    level = _score_to_level(score)
    level_text = LEVEL_TEXT_MAP[level]

    if level == "high":
        suggestions.append("建议48小时内完成一次全园风险复查并登记处置结果。")
    elif level == "mid":
        suggestions.append("建议3天内复查关键风险点并更新农事计划。")
    else:
        suggestions.append("保持日常监测，关注天气和病害记录变化。")

    reason = "；".join([f"{x.title}:{x.reason}" for x in hits[:3]])
    suggestion = "；".join(list(dict.fromkeys(suggestions)))

    return RiskRuleResult(
        level=level,
        level_text=level_text,
        score=score,
        hits=hits,
        reason=reason,
        suggestion=suggestion,
        suggestions=list(dict.fromkeys(suggestions)),
    )


def _apply_weather_humidity_rule(features: RiskInputFeatures, hits: List[RuleHit], suggestions: List[str]) -> None:
    is_growth_stage = any(x in features.stage for x in ["花期", "果实膨大期", "成熟期"])
    if features.rainy_days_3d >= 2 and features.weather_humidity >= 80 and is_growth_stage:
        level = "high" if features.rainy_days_3d >= 3 else "mid"
        score = 36 if level == "high" else 24
        hits.append(
            RuleHit(
                code="weather-humidity-spread",
                title="高湿降雨扩散风险",
                level=level,
                score=score,
                reason=f"未来3天降雨{features.rainy_days_3d}天且湿度{features.weather_humidity:.0f}%，处于{features.stage}。",
                evidence={
                    "rainy_days_3d": features.rainy_days_3d,
                    "humidity": features.weather_humidity,
                    "stage": features.stage,
                },
            )
        )
        suggestions.append("加强病斑区域巡检，雨后优先复拍疑似病株。")


def _apply_heat_drought_rule(features: RiskInputFeatures, hits: List[RuleHit], suggestions: List[str]) -> None:
    if features.weather_temp >= 32 and features.days_without_irrigation >= 5:
        level = "high" if features.weather_temp >= 35 or features.days_without_irrigation >= 8 else "mid"
        score = 34 if level == "high" else 22
        hits.append(
            RuleHit(
                code="heat-drought-stress",
                title="高温干旱胁迫风险",
                level=level,
                score=score,
                reason=f"气温{features.weather_temp:.1f}℃且已{features.days_without_irrigation}天未灌溉。",
                evidence={
                    "temp": features.weather_temp,
                    "days_without_irrigation": features.days_without_irrigation,
                },
            )
        )
        suggestions.append("尽快安排灌溉，优先在早晚低温时段作业。")


def _apply_disease_history_rule(features: RiskInputFeatures, hits: List[RuleHit], suggestions: List[str]) -> None:
    if features.recent_disease_count >= 2:
        level = "high" if features.recent_high_disease_count >= 1 else "mid"
        score = 30 if level == "high" else 18
        reason = (
            f"近7天病害记录{features.recent_disease_count}条，其中高风险{features.recent_high_disease_count}条。"
        )
        if features.latest_disease_confidence is not None:
            reason += f" 最新识别置信度{features.latest_disease_confidence:.2f}。"

        hits.append(
            RuleHit(
                code="disease-history",
                title="病害历史风险",
                level=level,
                score=score,
                reason=reason,
                evidence={
                    "recent_disease_count": features.recent_disease_count,
                    "recent_high_disease_count": features.recent_high_disease_count,
                    "latest_disease_confidence": features.latest_disease_confidence,
                },
            )
        )
        suggestions.append("对高风险地块执行复拍复核，并形成针对性防治清单。")


def _apply_stage_sensitive_rule(features: RiskInputFeatures, hits: List[RuleHit], suggestions: List[str]) -> None:
    if "花期" in features.stage and features.weather_humidity >= 85:
        hits.append(
            RuleHit(
                code="flower-stage-sensitive",
                title="花期敏感风险",
                level="mid",
                score=12,
                reason="花期对高湿较敏感，授粉与病害管理需同步加强。",
                evidence={"stage": features.stage, "humidity": features.weather_humidity},
            )
        )
        suggestions.append("花期建议提高巡检频次并减少高风险操作扰动。")


def _apply_history_rule(features: RiskInputFeatures, hits: List[RuleHit], suggestions: List[str]) -> None:
    if features.history_high_risk_count_30d >= 2:
        hits.append(
            RuleHit(
                code="history-high-risk-repeat",
                title="历史高风险复发",
                level="mid",
                score=14,
                reason=f"近30天历史高风险记录{features.history_high_risk_count_30d}次，存在复发倾向。",
                evidence={"high_risk_count_30d": features.history_high_risk_count_30d},
            )
        )
        suggestions.append("建议复盘近30天高风险处置记录，补齐薄弱环节。")


def _score_to_level(score: int) -> str:
    if score >= 60:
        return "high"
    if score >= 30:
        return "mid"
    return "low"


# TODO: 后续增加规则优先级与互斥机制，减少重复命中。
