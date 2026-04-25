from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .dataset import FruitGradeDataset


@dataclass
class TrainConfig:
    dataset_root: Path
    output_model: Path
    test_size: float = 0.2
    random_state: int = 42


def train_grade_model(config: TrainConfig) -> dict:
    dataset = FruitGradeDataset(config.dataset_root)
    features, labels = dataset.load()

    merged = pd.merge(features, labels[["image_id", "grade_code"]], on="image_id", how="inner")
    if merged.empty:
        raise ValueError("No matched records between features.csv and labels.csv")

    x = merged[
        [
            "color_score",
            "defect_ratio",
            "diameter_mm",
            "brix",
            "weight_g",
            "region",
            "channel",
            "package_type",
        ]
    ]
    y = merged["grade_code"].astype(str).str.upper()

    numeric_features = ["color_score", "defect_ratio", "diameter_mm", "brix", "weight_g"]
    categorical_features = ["region", "channel", "package_type"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", numeric_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("clf", RandomForestClassifier(n_estimators=120, random_state=config.random_state)),
        ]
    )

    metrics: dict[str, float | str | None] = {
        "accuracy": None,
        "macroF1": None,
        "note": None,
    }

    unique_classes = sorted({str(v) for v in y.unique()})
    can_split = len(merged) >= 20 and len(unique_classes) >= 2

    if can_split:
        x_train, x_val, y_train, y_val = train_test_split(
            x,
            y,
            test_size=config.test_size,
            random_state=config.random_state,
            stratify=y,
        )
        model.fit(x_train, y_train)

        y_pred = model.predict(x_val)
        metrics["accuracy"] = round(float(accuracy_score(y_val, y_pred)), 4)
        metrics["macroF1"] = round(float(f1_score(y_val, y_pred, average="macro")), 4)
    else:
        model.fit(x, y)
        metrics["note"] = "Dataset too small or single-class; skipped validation split"

    config.output_model.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, config.output_model)

    return {
        "modelPath": str(config.output_model),
        "samples": int(len(merged)),
        "classes": unique_classes,
        "metrics": metrics,
    }
