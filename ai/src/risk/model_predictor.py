from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np

from .feature_builder import RiskInputFeatures


class RiskModelPredictor:
    """表格模型预测器预留接口（可接 LightGBM/XGBoost/Sklearn）。"""

    def __init__(self, model_path: str | None = None) -> None:
        self.model_path = model_path
        self.model = None
        if model_path and Path(model_path).exists():
            self.model = joblib.load(model_path)

    def predict(self, features: RiskInputFeatures) -> Optional[Dict[str, Any]]:
        if self.model is None:
            return None

        x = self._to_model_features(features)

        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(x)[0]
            if len(probs) >= 3:
                low, mid, high = float(probs[0]), float(probs[1]), float(probs[2])
                level = "high" if high >= max(low, mid) else "mid" if mid >= low else "low"
                return {
                    "level": level,
                    "probabilities": {"low": low, "mid": mid, "high": high},
                    "model": self._guess_model_type(),
                }

        pred = self.model.predict(x)
        return {
            "level": str(pred[0]),
            "probabilities": None,
            "model": self._guess_model_type(),
        }

    def _to_model_features(self, f: RiskInputFeatures) -> np.ndarray:
        return np.array(
            [[
                f.weather_temp,
                f.weather_humidity,
                f.rainy_days_3d,
                f.recent_disease_count,
                f.recent_high_disease_count,
                f.latest_disease_confidence if f.latest_disease_confidence is not None else 0.0,
                f.days_without_irrigation,
                1.0 if f.has_recent_pesticide else 0.0,
                f.history_high_risk_count_30d,
            ]],
            dtype=np.float32,
        )

    def _guess_model_type(self) -> str:
        name = type(self.model).__name__.lower() if self.model is not None else "unknown"
        if "lightgbm" in name or "lgbm" in name:
            return "lightgbm"
        if "xgb" in name or "xgboost" in name:
            return "xgboost"
        return name


# TODO: 后续增加特征顺序签名校验，防止线上线下特征错位。
