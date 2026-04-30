from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Tuple

import yaml

from .feature_extractor import VisualQualityFeatures
from .schema import FruitGradeInput, FruitQualityScores


DEFAULT_GRADING_CONFIG: Dict[str, Any] = {
    "weights": {
        "color": 0.30,
        "defect": 0.25,
        "size": 0.20,
        "maturity": 0.25,
    },
    "grade_thresholds": {
        "A": 85,
        "B": 72,
    },
    "defect_ratio_limits": {
        "A": 0.05,
        "B": 0.12,
    },
    "minimum_scores": {
        "A": {"color": 82, "size": 78, "maturity": 78},
        "B": {"color": 70, "size": 65, "maturity": 65},
    },
}


@dataclass
class GradeDecision:
    grade: str
    reason: str
    factors: Dict[str, Any]


def load_grading_config(config_path: str | None = None) -> Dict[str, Any]:
    if not config_path:
        return DEFAULT_GRADING_CONFIG

    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Grading config not found: {config_path}")

    data = yaml.safe_load(path.read_text(encoding="utf-8-sig")) or {}
    return {
        **DEFAULT_GRADING_CONFIG,
        **data,
        "weights": {**DEFAULT_GRADING_CONFIG["weights"], **data.get("weights", {})},
        "grade_thresholds": {**DEFAULT_GRADING_CONFIG["grade_thresholds"], **data.get("grade_thresholds", {})},
        "defect_ratio_limits": {
            **DEFAULT_GRADING_CONFIG["defect_ratio_limits"],
            **data.get("defect_ratio_limits", {}),
        },
        "minimum_scores": {
            **DEFAULT_GRADING_CONFIG["minimum_scores"],
            **data.get("minimum_scores", {}),
        },
    }


def compute_quality_scores(
    input_data: FruitGradeInput,
    features: VisualQualityFeatures,
    config: Dict[str, Any],
) -> FruitQualityScores:
    redness = features.mean_r / max(features.mean_r + features.mean_g + features.mean_b, 1e-6)
    color_score = 60 + 45 * redness + 18 * features.saturation_mean - 15 * features.low_sat_ratio
    color_score = _clip(color_score, 45, 98)

    defect_ratio = 0.02 + features.dark_pixel_ratio * 0.55 + features.texture_std * 0.10
    defect_ratio = _clip(defect_ratio, 0.01, 0.30)

    if input_data.diameter_mm is not None:
        size_score = 50 + (input_data.diameter_mm - 55) * 1.3
    elif input_data.weight_g is not None:
        size_score = 50 + (input_data.weight_g - 120) * 0.12
    else:
        size_score = 58 + features.brightness_mean * 28
    size_score = _clip(size_score, 45, 98)

    if input_data.brix is not None:
        maturity_score = 50 + input_data.brix * 3.6
    else:
        maturity_score = 55 + features.saturation_mean * 24 + features.brightness_mean * 12
    maturity_score = _clip(maturity_score, 45, 98)

    weights = config["weights"]
    defect_score = max(0.0, 100 - defect_ratio * 100)
    overall = (
        color_score * float(weights["color"])
        + defect_score * float(weights["defect"])
        + size_score * float(weights["size"])
        + maturity_score * float(weights["maturity"])
    )

    return FruitQualityScores(
        color_score=round(float(color_score), 2),
        defect_ratio=round(float(defect_ratio), 4),
        size_score=round(float(size_score), 2),
        maturity_score=round(float(maturity_score), 2),
        overall_quality_score=round(float(overall), 2),
    )


def decide_grade(scores: FruitQualityScores, config: Dict[str, Any]) -> GradeDecision:
    thresholds = config["grade_thresholds"]
    defect_limits = config["defect_ratio_limits"]
    minimum_scores = config["minimum_scores"]

    grade = "C"
    if _is_grade_a(scores, thresholds, defect_limits, minimum_scores):
        grade = "A"
    elif _is_grade_b(scores, thresholds, defect_limits, minimum_scores):
        grade = "B"

    reason = (
        f"综合质量分{scores.overall_quality_score}，色泽{scores.color_score}分，"
        f"果径{scores.size_score}分，成熟度{scores.maturity_score}分，缺陷率{round(scores.defect_ratio * 100, 2)}%。"
    )

    return GradeDecision(
        grade=grade,
        reason=reason,
        factors={
            "overallQualityScore": scores.overall_quality_score,
            "gradeThresholds": thresholds,
            "defectRatioLimits": defect_limits,
        },
    )


def _is_grade_a(scores: FruitQualityScores, thresholds: Dict[str, float], defect_limits: Dict[str, float], minimum_scores: Dict[str, Dict[str, float]]) -> bool:
    mins = minimum_scores.get("A", {})
    return (
        scores.overall_quality_score >= float(thresholds["A"])
        and scores.defect_ratio <= float(defect_limits["A"])
        and scores.color_score >= float(mins.get("color", 0))
        and scores.size_score >= float(mins.get("size", 0))
        and scores.maturity_score >= float(mins.get("maturity", 0))
    )


def _is_grade_b(scores: FruitQualityScores, thresholds: Dict[str, float], defect_limits: Dict[str, float], minimum_scores: Dict[str, Dict[str, float]]) -> bool:
    mins = minimum_scores.get("B", {})
    return (
        scores.overall_quality_score >= float(thresholds["B"])
        and scores.defect_ratio <= float(defect_limits["B"])
        and scores.color_score >= float(mins.get("color", 0))
        and scores.size_score >= float(mins.get("size", 0))
        and scores.maturity_score >= float(mins.get("maturity", 0))
    )


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


# TODO: 后续引入小样本回归模型替代部分线性映射参数。
