from __future__ import annotations

from dataclasses import dataclass
from hashlib import md5
import logging
from pathlib import Path
from typing import Any, Dict

from pydantic import ValidationError

from disease.business import to_business_result
from fruit_grade.infer import infer_grade
from fruit_grade.predict import predict_from_dict
from fruit_grade.pricing_rules import calculate_price_range, load_price_config
from fruit_grade.schema import FruitQualityScores, parse_fruit_input
from risk.service import RiskAssessmentService
from service.adapters.disease_adapter import DiseaseAdapter
from service.adapters.fruit_adapter import FruitAdapter
from service.adapters.local_disease_predictor import (
    LocalDiseasePredictor,
    LocalDiseasePredictorError,
    SEVERITY_ZH_TO_CODE,
)
from service.adapters.risk_adapter import RiskAdapter
from service.clients.llm_client import ExternalAPIError, LLMClient
from service.settings import ServiceSettings
from service.utils.image_utils import resolve_image_url


logger = logging.getLogger(__name__)

LOW_CONF_REVIEW_TIP = "Current result is uncertain; manual review is recommended. "
SEVERITY_CODE_TO_ZH = {
    "low": "low",
    "mid": "mid",
    "high": "high",
}


def _stable_float(seed: str, low: float, high: float) -> float:
    digest = md5(seed.encode("utf-8")).hexdigest()
    ratio = int(digest[:8], 16) / 0xFFFFFFFF
    return round(low + (high - low) * ratio, 4)


def _build_llm_client() -> LLMClient | None:
    settings = ServiceSettings.from_env()
    if not settings.external_api_enabled:
        return None
    try:
        return LLMClient(settings)
    except ExternalAPIError as exc:
        logger.warning("Failed to initialize external API client: %s", exc)
        return None


def _clamp_float(value: Any, low: float, high: float, default: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = default
    return max(low, min(high, numeric))


@dataclass
class DiseasePredictor:
    """Disease pipeline:
    1) Local disease model inference is primary.
    2) LLM only generates advice/reasoning from structured local result.
    3) If local model fails, fallback to current rule placeholder logic.
    """

    rule_fallback_model_version: str = "rule-placeholder-v1"

    def __post_init__(self) -> None:
        settings = ServiceSettings.from_env()
        self.low_confidence_threshold = settings.disease_low_confidence_threshold
        self.local_predictor = LocalDiseasePredictor(
            default_model_path=settings.disease_model_path,
            label_map_path=settings.disease_label_map_path,
            low_confidence_threshold=settings.disease_low_confidence_threshold,
            model_version=settings.disease_model_version,
        )
        self.advice_adapter = DiseaseAdapter(_build_llm_client())

    def predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            local = self.local_predictor.predict(payload)
            response = self._build_local_response(local)
        except LocalDiseasePredictorError as exc:
            logger.warning("Local disease model failed, fallback to rule logic: %s", exc)
            fallback = self._predict_rule_fallback(payload)
            fallback["source"] = {
                "engine": "rule-fallback",
                "fallbackUsed": True,
                "reason": str(exc),
            }
            return fallback

        if self.advice_adapter.llm_client is None:
            return response

        try:
            advice_input = {
                "cropType": payload.get("cropType") or payload.get("crop_type") or "citrus",
                "label": response["label"],
                "confidence": response["confidence"],
                "severity": response.get("severityText") or response["severity"],
                "needManualReview": response["needManualReview"],
                "region": payload.get("region"),
                "growthStage": payload.get("growthStage") or payload.get("growth_stage"),
                "weather": payload.get("weather"),
            }
            llm = self.advice_adapter.generate_advice(advice_input)
            advice = str(llm.get("advice") or "").strip()
            reasoning = str(llm.get("reasoning") or "").strip()

            if advice:
                response["suggestion"] = advice
                response["advice"] = advice
            if reasoning:
                response["reasoning"] = reasoning

            response["source"]["llmAdviceUsed"] = True
            return response
        except (ExternalAPIError, ValidationError, ValueError) as exc:
            logger.warning("Disease advice generation failed, keep local result: %s", exc)
            response["source"]["llmAdviceUsed"] = False
            response["source"]["llmAdviceFallbackReason"] = str(exc)
            return response

    def _build_local_response(self, local: Dict[str, Any]) -> Dict[str, Any]:
        label = str(local["label"])
        confidence = _clamp_float(local["confidence"], 0.0, 1.0, 0.0)

        severity_text = str(local.get("severity") or "mid")
        severity_code = str(local.get("severityCode") or SEVERITY_ZH_TO_CODE.get(severity_text, "mid"))
        if severity_code not in {"low", "mid", "high"}:
            severity_code = "mid"
        if severity_text not in {"high", "mid", "low"}:
            severity_text = SEVERITY_CODE_TO_ZH[severity_code]

        need_manual = bool(local["needManualReview"] or confidence < self.low_confidence_threshold)

        advice = str(local.get("fallbackAdvice") or LOW_CONF_REVIEW_TIP).strip()
        if need_manual and LOW_CONF_REVIEW_TIP not in advice and confidence < self.low_confidence_threshold:
            advice = f"{LOW_CONF_REVIEW_TIP}{advice}".strip()

        reasoning = str(local.get("fallbackReasoning") or "").strip()
        if need_manual and LOW_CONF_REVIEW_TIP not in reasoning and confidence < self.low_confidence_threshold:
            reasoning = f"{LOW_CONF_REVIEW_TIP}{reasoning}".strip()

        model_version = str(local.get("modelVersion") or "local-model-v1")

        return {
            "diseaseName": label,
            "label": label,
            "confidence": confidence,
            "severity": severity_code,  # keep backend contract
            "severityText": severity_text,
            "needManualReview": need_manual,
            "suggestion": advice,
            "advice": advice,
            "reasoning": reasoning,
            "modelVersion": model_version,
            "boxes": [],
            "scores": local.get("scores", {}),
            "source": {
                "engine": "local-disease-model",
                "fallbackUsed": False,
                "llmAdviceUsed": False,
                "backbone": local.get("backbone"),
                "modelPath": local.get("modelPath"),
                "labelMapPath": local.get("labelMapPath") or "",
                "lowConfidenceThreshold": local.get("lowConfidenceThreshold", self.low_confidence_threshold),
            },
        }

    def _predict_rule_fallback(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        image_url = resolve_image_url(payload)
        text = image_url.lower()

        if "canker" in text:
            label = "canker"
        elif "anthracnose" in text:
            label = "anthracnose"
        elif "mite" in text:
            label = "mite"
        else:
            label = "normal"

        confidence = _stable_float(image_url or "unknown", 0.66, 0.94)
        business = to_business_result(label=label, confidence=confidence)
        severity_code = business.severity if business.severity in {"low", "mid", "high"} else "mid"
        severity_text = SEVERITY_CODE_TO_ZH.get(severity_code, "mid")
        need_manual = bool(
            business.needManualReview or business.confidence < self.low_confidence_threshold
        )

        advice = business.advice
        reasoning = business.narrative
        if need_manual and confidence < self.low_confidence_threshold:
            if LOW_CONF_REVIEW_TIP not in advice:
                advice = f"{LOW_CONF_REVIEW_TIP}{advice}".strip()
            if LOW_CONF_REVIEW_TIP not in reasoning:
                reasoning = f"{LOW_CONF_REVIEW_TIP}{reasoning}".strip()

        return {
            "diseaseName": business.label,
            "label": business.label,
            "confidence": float(business.confidence),
            "severity": severity_code,
            "severityText": severity_text,
            "needManualReview": need_manual,
            "suggestion": advice,
            "advice": advice,
            "reasoning": reasoning,
            "modelVersion": self.rule_fallback_model_version,
            "boxes": [],
        }


@dataclass
class FruitPredictor:
    """Local rules for grade/price remain primary; external API is auxiliary."""

    def __post_init__(self) -> None:
        self.adapter = FruitAdapter(_build_llm_client())
        settings = ServiceSettings.from_env()
        configured_model = (settings.fruit_grade_model_path or "").strip()
        self.fruit_grade_model_path = Path(configured_model).resolve() if configured_model else None
        if self.fruit_grade_model_path is None:
            default_model = Path("./models/fruit_grade/grade_model.joblib").resolve()
            self.fruit_grade_model_path = default_model if default_model.exists() else None
        self.price_config = load_price_config(None)

    def predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        local_result = self._predict_local(payload)
        local_source = dict(local_result.get("source") or {})
        image_url = resolve_image_url(payload)
        if not image_url or self.adapter.llm_client is None:
            local_result["source"] = {**local_source, "externalVisionUsed": False}
            return local_result

        merged = dict(local_result)
        try:
            visual = self.adapter.analyze(payload)
            merged["colorScore"] = _clamp_float(visual.get("colorScore"), 0.0, 100.0, merged["colorScore"])
            merged["defectRatio"] = _clamp_float(visual.get("defectRatio"), 0.0, 1.0, merged["defectRatio"])
            merged["sizeScore"] = _clamp_float(visual.get("sizeScore"), 0.0, 100.0, merged["sizeScore"])
            merged["maturityScore"] = _clamp_float(visual.get("maturityScore"), 0.0, 100.0, merged["maturityScore"])

            visual_reason = str(visual.get("explanation") or visual.get("description") or "").strip()
            if visual_reason:
                merged["reason"] = f"{merged['reason']}; visual analysis: {visual_reason}"

            merged_factors = dict(merged.get("factors") or {})
            merged_factors["visual"] = {
                "description": visual.get("description", ""),
                "source": "external-api",
            }
            merged_factors["coreCalculation"] = {
                "gradeBy": local_source.get("gradeBy", "local-rules"),
                "priceBy": local_source.get("priceBy", "local-rules"),
            }
            merged["factors"] = merged_factors
            merged["source"] = {
                **local_source,
                "engine": f"{local_source.get('engine', 'local-rules')}+external-vision",
                "externalVisionUsed": True,
            }
            return merged
        except (ExternalAPIError, ValidationError, ValueError) as exc:
            logger.warning("Fruit external API failed, fallback to local rule result: %s", exc)
            local_result["source"] = {
                **local_source,
                "externalVisionUsed": False,
                "reason": str(exc),
            }
            return local_result

    def _predict_local(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(payload)
        image_url = resolve_image_url(payload)
        if "image_path" not in normalized and "imagePath" not in normalized:
            normalized["image_path"] = image_url or "remote-image-placeholder"

        output = predict_from_dict(normalized)
        local_result = {
            "variety": output["variety"],
            "grade": output["grade"],
            "colorScore": output["colorScore"],
            "defectRatio": output["defectRatio"],
            "sizeScore": output["sizeScore"],
            "maturityScore": output["maturityScore"],
            "retailMinPrice": output["retailMinPrice"],
            "retailMaxPrice": output["retailMaxPrice"],
            "wholesaleMinPrice": output["wholesaleMinPrice"],
            "wholesaleMaxPrice": output["wholesaleMaxPrice"],
            "reason": output["reason"],
            "riskWarning": output["riskWarning"],
            "factors": output["factors"],
            "source": {
                "engine": "local-rules",
                "gradeBy": "local-rules",
                "priceBy": "local-rules",
                "gradeModelUsed": False,
            },
        }

        model_grade = self._predict_grade_with_model(normalized, local_result)
        if not model_grade:
            return local_result

        scores = FruitQualityScores(
            color_score=float(local_result["colorScore"]),
            defect_ratio=float(local_result["defectRatio"]),
            size_score=float(local_result["sizeScore"]),
            maturity_score=float(local_result["maturityScore"]),
            overall_quality_score=self._resolve_overall_quality_score(local_result),
        )
        input_data = parse_fruit_input(normalized)
        price_result = calculate_price_range(
            input_data=input_data,
            grade=model_grade["grade"],
            scores=scores,
            config=self.price_config,
        )

        local_result["grade"] = model_grade["grade"]
        local_result["retailMinPrice"] = price_result.retail_min_price
        local_result["retailMaxPrice"] = price_result.retail_max_price
        local_result["wholesaleMinPrice"] = price_result.wholesale_min_price
        local_result["wholesaleMaxPrice"] = price_result.wholesale_max_price
        local_result["riskWarning"] = self._build_risk_warning(scores=scores, grade=model_grade["grade"])
        local_result["reason"] = (
            f"{local_result['reason']} Model-based grade={model_grade['grade']}; "
            f"{price_result.reason}"
        )

        factors = dict(local_result.get("factors") or {})
        quality_factors = dict(factors.get("quality") or {})
        quality_factors["gradeModel"] = {
            "used": True,
            "modelPath": model_grade["modelPath"],
            "confidence": model_grade.get("confidence"),
        }
        factors["quality"] = quality_factors
        factors["pricing"] = price_result.factors
        factors["coreCalculation"] = {
            "gradeBy": "trained-tabular-model",
            "priceBy": "local-rules",
        }
        local_result["factors"] = factors
        local_result["source"] = {
            "engine": "local-rules+grade-model",
            "gradeBy": "trained-tabular-model",
            "priceBy": "local-rules",
            "gradeModelUsed": True,
            "gradeModelPath": model_grade["modelPath"],
        }
        return local_result

    def _predict_grade_with_model(
        self,
        payload: Dict[str, Any],
        local_result: Dict[str, Any],
    ) -> Dict[str, Any] | None:
        model_path = self._resolve_model_path(payload)
        if model_path is None or not model_path.exists():
            return None

        row = {
            "color_score": float(local_result["colorScore"]),
            "defect_ratio": float(local_result["defectRatio"]),
            "diameter_mm": self._pick_float(payload, ("diameter_mm", "diameterMm", "diameter"), 70.0),
            "brix": self._pick_float(payload, ("brix",), 12.0),
            "weight_g": self._pick_float(payload, ("weight_g", "weightG", "weight"), 180.0),
            "region": str(payload.get("region") or "default"),
            "channel": str(payload.get("channel") or "ecommerce"),
            "package_type": str(
                payload.get("package_type")
                or payload.get("packageType")
                or payload.get("packaging")
                or "simple"
            ),
        }
        try:
            inference = infer_grade(model_path=model_path, row=row)
        except Exception as exc:
            logger.warning("Fruit grade model inference failed, fallback to local rules: %s", exc)
            return None

        grade = str(inference.get("gradeCode") or "").strip().upper()
        if grade not in {"A", "B", "C"}:
            return None

        confidence = None
        proba = inference.get("probability")
        if isinstance(proba, dict) and proba.get("confidence") is not None:
            confidence = self._pick_float(proba, ("confidence",), None)

        return {
            "grade": grade,
            "confidence": confidence,
            "modelPath": str(model_path),
        }

    def _resolve_model_path(self, payload: Dict[str, Any]) -> Path | None:
        runtime_path = payload.get("modelPath") or payload.get("model_path")
        if runtime_path:
            path = Path(str(runtime_path)).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path
            return path.resolve()

        if self.fruit_grade_model_path and self.fruit_grade_model_path.exists():
            return self.fruit_grade_model_path
        return None

    @staticmethod
    def _pick_float(container: Dict[str, Any], keys: tuple[str, ...], default: float | None) -> float | None:
        for key in keys:
            if key not in container:
                continue
            value = container.get(key)
            if value is None or value == "":
                continue
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
        return default

    @staticmethod
    def _resolve_overall_quality_score(local_result: Dict[str, Any]) -> float:
        factors = dict(local_result.get("factors") or {})
        quality = dict(factors.get("quality") or {})
        value = quality.get("overallQualityScore")
        try:
            return float(value)
        except (TypeError, ValueError):
            defect_score = max(0.0, 100 - float(local_result["defectRatio"]) * 100)
            overall = (
                float(local_result["colorScore"]) * 0.30
                + defect_score * 0.25
                + float(local_result["sizeScore"]) * 0.20
                + float(local_result["maturityScore"]) * 0.25
            )
            return round(overall, 2)

    @staticmethod
    def _build_risk_warning(scores: FruitQualityScores, grade: str) -> str:
        warnings: list[str] = []
        if scores.defect_ratio > 0.12:
            warnings.append("Defect ratio is high; return risk may increase")
        if scores.maturity_score < 65:
            warnings.append("Maturity score is low; short-term taste risk is higher")
        if scores.size_score < 62:
            warnings.append("Fruit size score is low; channel acceptance may drop")
        if grade == "C":
            warnings.append("Grade is C; prioritize wholesale or processing channels")
        if not warnings:
            return "No obvious sales risk; keep normal shipment pace"
        return "; ".join(warnings)


@dataclass
class RiskPredictor:
    """Risk level stays local-rule driven; external API only polishes text."""

    model_path: str | None = None

    def __post_init__(self) -> None:
        self.service = RiskAssessmentService(model_path=self.model_path)
        self.adapter = RiskAdapter(_build_llm_client())

    def predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        local_output = self.service.assess(payload)
        if self.adapter.llm_client is None:
            return local_output

        explain_payload = {
            "level": local_output.get("level"),
            "levelText": local_output.get("levelText"),
            "reason": local_output.get("reason"),
            "suggestion": local_output.get("suggestion"),
            "ruleHits": ((local_output.get("source") or {}).get("rule") or {}).get("hits", []),
            "weatherSummary": ((local_output.get("source") or {}).get("features") or {}).get("weather_summary", ""),
            "diseaseSummary": ((local_output.get("source") or {}).get("features") or {}).get("disease_summary", ""),
        }

        try:
            explained = self.adapter.explain(explain_payload)
            if explained.get("reason"):
                local_output["reason"] = str(explained["reason"])
            if explained.get("suggestion"):
                local_output["suggestion"] = str(explained["suggestion"])
            if explained.get("observationFocus"):
                local_output["observationFocus"] = str(explained["observationFocus"])
            local_output["llm"] = {"enabled": True, "provider": "external-api-gateway"}
            return local_output
        except (ExternalAPIError, ValidationError, ValueError) as exc:
            logger.warning("Risk external API explain failed, keep local result: %s", exc)
            local_output["llm"] = {
                "enabled": False,
                "fallbackUsed": True,
                "reason": str(exc),
            }
            return local_output
