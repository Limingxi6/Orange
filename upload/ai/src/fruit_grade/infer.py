from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import pandas as pd


def infer_grade(model_path: Path, row: dict[str, Any]) -> dict[str, Any]:
    model = joblib.load(model_path)
    frame = pd.DataFrame([row])
    pred = model.predict(frame)[0]
    proba = None

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(frame)[0]
        classes = model.classes_
        max_idx = int(probs.argmax())
        proba = {
            "grade": str(classes[max_idx]),
            "confidence": float(probs[max_idx]),
        }

    return {
        "gradeCode": str(pred),
        "probability": proba,
    }

