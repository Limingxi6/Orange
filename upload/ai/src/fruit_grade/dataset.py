from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .feature_contract import FEATURE_COLUMNS, LABEL_COLUMNS


@dataclass
class FruitGradeDataset:
    dataset_root: Path

    @property
    def features_path(self) -> Path:
        return self.dataset_root / "features.csv"

    @property
    def labels_path(self) -> Path:
        return self.dataset_root / "labels.csv"

    @property
    def images_dir(self) -> Path:
        return self.dataset_root / "images"

    def load(self) -> tuple[pd.DataFrame, pd.DataFrame]:
        features = pd.read_csv(self.features_path)
        labels = pd.read_csv(self.labels_path)

        missing_feature_cols = [col for col in FEATURE_COLUMNS if col not in features.columns]
        missing_label_cols = [col for col in LABEL_COLUMNS if col not in labels.columns]

        if missing_feature_cols:
            raise ValueError(f"features.csv missing columns: {missing_feature_cols}")
        if missing_label_cols:
            raise ValueError(f"labels.csv missing columns: {missing_label_cols}")

        return features, labels

