from __future__ import annotations

import base64
import binascii
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator
from urllib.parse import urlparse

import requests

from disease.business import to_business_result
from disease.predict import DiseasePredictor as TorchDiseasePredictor


SEVERITY_CODE_TO_ZH = {
    "low": "低",
    "mid": "中",
    "high": "高",
}

SEVERITY_ZH_TO_CODE = {
    "低": "low",
    "中": "mid",
    "高": "high",
}


class LocalDiseasePredictorError(RuntimeError):
    pass


class LocalDiseasePredictor:
    """Local model disease predictor.

    Uses existing `ai/src/disease` predictor as primary inference path.
    """

    def __init__(
        self,
        default_model_path: str | None = None,
        label_map_path: str | None = None,
        low_confidence_threshold: float = 0.65,
        model_version: str = "local-model-v1",
    ) -> None:
        self.default_model_path = default_model_path
        self.label_map_path = label_map_path
        self.low_confidence_threshold = max(0.0, min(1.0, float(low_confidence_threshold)))
        self.model_version = model_version
        self._cache: dict[str, TorchDiseasePredictor] = {}

    def predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        image_ref = self._pick_image(payload)
        if not image_ref:
            raise LocalDiseasePredictorError("imageUrl is required for local disease inference")

        model_path = self._resolve_model_path(payload)
        predictor = self._get_or_load_predictor(model_path)

        with self._materialize_image(image_ref) as image_path:
            model_result = predictor.predict_single(image_path=image_path)

        confidence = self._clamp(float(model_result.get("confidence", 0.0)), 0.0, 1.0)
        label = str(model_result.get("label", "unknown")) or "unknown"

        business = to_business_result(
            label=label,
            confidence=confidence,
            crop_type=self._optional_str(payload.get("cropType") or payload.get("crop_type")),
            growth_stage=self._optional_str(payload.get("growthStage") or payload.get("growth_stage")),
            weather=self._optional_str(payload.get("weather")),
            region=self._optional_str(payload.get("region")),
        )

        severity_code = business.severity if business.severity in {"low", "mid", "high"} else "mid"
        severity = SEVERITY_CODE_TO_ZH.get(severity_code, "中")
        need_manual = bool(
            business.needManualReview
            or confidence < self.low_confidence_threshold
            or severity_code not in {"low", "mid", "high"}
        )

        model_path_obj = Path(model_path)
        resolved_model_version = self._compose_model_version(model_path_obj)

        return {
            "label": business.label,
            "confidence": confidence,
            "severity": severity,  # local stable output in 中文
            "severityCode": severity_code,  # compatibility for downstream mapping
            "needManualReview": need_manual,
            "modelVersion": resolved_model_version,
            "fallbackAdvice": business.advice,
            "fallbackReasoning": business.narrative,
            "scores": model_result.get("scores", {}),
            "backbone": model_result.get("backbone"),
            "modelPath": str(model_path_obj),
            "labelMapPath": self.label_map_path or "",
            "lowConfidenceThreshold": self.low_confidence_threshold,
        }

    def _pick_image(self, payload: Dict[str, Any]) -> str:
        for key in ("imageUrl", "image_url", "imagePath", "image_path"):
            value = payload.get(key)
            if value:
                return str(value).strip()
        return ""

    def _resolve_model_path(self, payload: Dict[str, Any]) -> str:
        explicit = payload.get("modelPath") or payload.get("model_path")
        candidate = self._resolve_model_candidate(str(explicit).strip()) if explicit else None
        if candidate:
            return candidate

        default = self._resolve_model_candidate(self.default_model_path or "")
        if default:
            return default

        env_model = self._resolve_model_candidate(
            (os.getenv("DISEASE_MODEL_PATH") or os.getenv("MODEL_PATH") or "").strip()
        )
        if env_model:
            return env_model

        project_default = Path(__file__).resolve().parents[2] / "models" / "disease_classifier_leaves.pt"
        if project_default.exists():
            return str(project_default)

        raise LocalDiseasePredictorError("Local disease model file is not found")

    def _resolve_model_candidate(self, value: str) -> str | None:
        if not value:
            return None
        path = Path(value)
        if path.is_dir():
            file_path = path / "disease_classifier_leaves.pt"
            if file_path.exists():
                return str(file_path)
            return None
        if path.exists() and path.is_file():
            return str(path)
        return None

    def _compose_model_version(self, model_path: Path) -> str:
        base = (self.model_version or "local-model-v1").strip()
        if ":" in base:
            return base
        return f"{base}:{model_path.name}"

    def _get_or_load_predictor(self, model_path: str) -> TorchDiseasePredictor:
        key = str(Path(model_path).resolve())
        existing = self._cache.get(key)
        if existing is not None:
            return existing

        try:
            loaded = TorchDiseasePredictor(model_path=key, device="auto")
        except Exception as exc:
            raise LocalDiseasePredictorError(f"Failed to load local disease model: {exc}") from exc

        self._cache[key] = loaded
        return loaded

    @contextmanager
    def _materialize_image(self, image_ref: str) -> Iterator[str]:
        value = image_ref.strip()
        if value.startswith("http://") or value.startswith("https://"):
            temp_path = self._download_image(value)
            try:
                yield temp_path
            finally:
                Path(temp_path).unlink(missing_ok=True)
            return

        if value.startswith("data:image/"):
            temp_path = self._decode_data_url(value)
            try:
                yield temp_path
            finally:
                Path(temp_path).unlink(missing_ok=True)
            return

        path = Path(value)
        if path.exists() and path.is_file():
            yield str(path)
            return

        raise LocalDiseasePredictorError("Unsupported image source for local inference")

    def _download_image(self, url: str) -> str:
        suffix = self._suffix_from_url(url)
        handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            resp = requests.get(url, timeout=8)
            resp.raise_for_status()
            handle.write(resp.content)
            return handle.name
        except Exception as exc:
            raise LocalDiseasePredictorError(f"Failed to download image: {exc}") from exc
        finally:
            handle.close()

    def _decode_data_url(self, data_url: str) -> str:
        _, _, encoded = data_url.partition(",")
        if not encoded:
            raise LocalDiseasePredictorError("Invalid data URL image payload")
        handle = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
        try:
            raw = base64.b64decode(encoded, validate=True)
            handle.write(raw)
            return handle.name
        except (binascii.Error, ValueError) as exc:
            raise LocalDiseasePredictorError(f"Invalid base64 image payload: {exc}") from exc
        finally:
            handle.close()

    def _suffix_from_url(self, url: str) -> str:
        parsed = urlparse(url)
        path = parsed.path or ""
        suffix = Path(path).suffix.lower()
        if suffix in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
            return suffix
        return ".jpg"

    def _optional_str(self, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text if text else None

    def _clamp(self, value: float, low: float, high: float) -> float:
        return max(low, min(high, value))
