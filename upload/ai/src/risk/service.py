from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, List

from .feature_builder import RiskInputFeatures, build_risk_features
from .model_predictor import RiskModelPredictor
from .rules_engine import RiskRuleResult, evaluate_rules


LEVEL_TEXT = {
    "high": "高",
    "mid": "中",
    "low": "低",
}


class RiskAssessmentService:
    def __init__(self, model_path: str | None = None, llm_explainer=None) -> None:
        self.model_predictor = RiskModelPredictor(model_path=model_path)
        self.llm_explainer = llm_explainer

    def assess(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        features = build_risk_features(payload)
        rule_result = evaluate_rules(features)
        model_result = self.model_predictor.predict(features)

        final_level = self._fuse_level(rule_result.level, model_result)
        level_text = LEVEL_TEXT.get(final_level, "低")

        reason = rule_result.reason
        suggestion = rule_result.suggestion

        output = {
            "level": final_level,
            "levelText": level_text,
            "reason": reason,
            "suggestion": suggestion,
            "source": {
                "fusion": "rule_only" if model_result is None else "rule_plus_model_gate",
                "rule": self._rule_to_dict(rule_result),
                "model": model_result,
                "features": asdict(features),
            },
        }

        if self.llm_explainer is not None:
            llm_payload = self._build_llm_payload(features=features, rule_result=rule_result, output=output)
            llm_result = self.llm_explainer.explain(llm_payload)

            # 关键约束：LLM不允许修改风险级别
            output["reason"] = llm_result.get("reason") or output["reason"]
            output["suggestion"] = llm_result.get("suggestion") or output["suggestion"]
            if llm_result.get("observationFocus"):
                output["observationFocus"] = llm_result["observationFocus"]
            output["llm"] = {
                "enabled": True,
                "raw": llm_result.get("raw"),
            }
        else:
            output["llm"] = {"enabled": False}

        return output

    def _fuse_level(self, rule_level: str, model_result: Dict[str, Any] | None) -> str:
        if model_result is None:
            return rule_level

        model_level = str(model_result.get("level", "")).lower()
        if model_level not in LEVEL_TEXT:
            return rule_level

        order = {"low": 1, "mid": 2, "high": 3}
        return model_level if order[model_level] > order[rule_level] else rule_level

    def _rule_to_dict(self, result: RiskRuleResult) -> Dict[str, Any]:
        return {
            "level": result.level,
            "levelText": result.level_text,
            "score": result.score,
            "reason": result.reason,
            "suggestion": result.suggestion,
            "hits": [
                {
                    "code": hit.code,
                    "title": hit.title,
                    "level": hit.level,
                    "score": hit.score,
                    "reason": hit.reason,
                    "evidence": hit.evidence,
                }
                for hit in result.hits
            ],
            "suggestions": result.suggestions,
        }

    def _build_llm_payload(
        self,
        features: RiskInputFeatures,
        rule_result: RiskRuleResult,
        output: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "level": output["level"],
            "levelText": output["levelText"],
            "ruleHits": [
                {
                    "title": x.title,
                    "level": x.level,
                    "reason": x.reason,
                    "score": x.score,
                }
                for x in rule_result.hits
            ],
            "weatherSummary": features.weather_summary,
            "diseaseSummary": features.disease_summary,
            "farmingSummary": self._farming_summary(features.farming_actions, features.days_without_irrigation),
            "stage": features.stage or "未提供",
            "reason": output["reason"],
            "suggestion": output["suggestion"],
        }

    def _farming_summary(self, actions: List[str], days_without_irrigation: int) -> str:
        action_text = "、".join(actions) if actions else "无关键农事记录"
        return f"关键农事: {action_text}；距上次灌溉约{days_without_irrigation}天"


if __name__ == "__main__":
    # TODO: 后续增加HTTP服务封装，供NestJS直接远程调用。
    sample = {
        "batch": {"batchId": 1001, "stage": "果实膨大期"},
        "weather": {
            "temp": 33,
            "humidity": 84,
            "forecastData": [{"condition": "小雨"}, {"condition": "中雨"}, {"condition": "多云"}],
        },
        "disease": {"recentDiseaseCount": 2, "recentHighDiseaseCount": 1, "latestDiseaseConfidence": 0.86},
        "farming": {"daysWithoutIrrigation": 6},
    }
    print(RiskAssessmentService().assess(sample))
