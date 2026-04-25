"""Feature contract for fruit perception + tabular grade model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class FruitPerceptionFeature:
    image_id: str
    color_score: float
    defect_ratio: float
    diameter_mm: Optional[float] = None
    brix: Optional[float] = None
    weight_g: Optional[float] = None
    region: Optional[str] = None
    channel: Optional[str] = None
    package_type: Optional[str] = None


@dataclass
class FruitGradeLabel:
    image_id: str
    grade_code: str
    target_retail_price: float
    target_wholesale_price: float


FEATURE_COLUMNS = [
    "image_id",
    "color_score",
    "defect_ratio",
    "diameter_mm",
    "brix",
    "weight_g",
    "region",
    "channel",
    "package_type",
]

LABEL_COLUMNS = [
    "image_id",
    "grade_code",
    "target_retail_price",
    "target_wholesale_price",
]

