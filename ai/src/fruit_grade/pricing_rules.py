from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

import yaml

from .schema import FruitGradeInput, FruitQualityScores


DEFAULT_PRICE_CONFIG: Dict[str, Any] = {
    "baseline_price": {
        "default": {"A": 7.2, "B": 5.8, "C": 4.3},
        "纽荷尔脐橙": {"A": 7.4, "B": 6.0, "C": 4.5},
    },
    "channel_coeff": {
        "ecommerce": 1.08,
        "wholesale": 0.90,
        "supermarket": 1.03,
        "live_stream": 1.06,
        "电商": 1.08,
        "批发": 0.90,
        "商超": 1.03,
        "直播": 1.06,
    },
    "packaging_coeff": {
        "simple": 1.00,
        "gift": 1.12,
        "premium": 1.22,
        "简装": 1.00,
        "礼盒": 1.12,
        "精品礼盒": 1.22,
    },
    "region_coeff": {
        "default": 1.00,
        "湖北宜昌": 1.02,
        "湖南常德": 0.98,
        "江西赣州": 1.01,
    },
    "quality_coeff": {
        "high": 1.06,
        "mid": 1.00,
        "low": 0.94,
    },
    "price_interval": {
        "retail": {"min_ratio": 0.94, "max_ratio": 1.08},
        "wholesale": {"min_ratio": 0.62, "max_ratio": 0.72},
    },
}


@dataclass
class PriceResult:
    retail_min_price: float
    retail_max_price: float
    wholesale_min_price: float
    wholesale_max_price: float
    factors: Dict[str, Any]
    reason: str


def load_price_config(config_path: str | None = None) -> Dict[str, Any]:
    if not config_path:
        return DEFAULT_PRICE_CONFIG

    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Price config not found: {config_path}")

    data = yaml.safe_load(path.read_text(encoding="utf-8-sig")) or {}
    return {
        **DEFAULT_PRICE_CONFIG,
        **data,
        "baseline_price": {**DEFAULT_PRICE_CONFIG["baseline_price"], **data.get("baseline_price", {})},
        "channel_coeff": {**DEFAULT_PRICE_CONFIG["channel_coeff"], **data.get("channel_coeff", {})},
        "packaging_coeff": {**DEFAULT_PRICE_CONFIG["packaging_coeff"], **data.get("packaging_coeff", {})},
        "region_coeff": {**DEFAULT_PRICE_CONFIG["region_coeff"], **data.get("region_coeff", {})},
        "quality_coeff": {**DEFAULT_PRICE_CONFIG["quality_coeff"], **data.get("quality_coeff", {})},
        "price_interval": {**DEFAULT_PRICE_CONFIG["price_interval"], **data.get("price_interval", {})},
    }


def calculate_price_range(
    input_data: FruitGradeInput,
    grade: str,
    scores: FruitQualityScores,
    config: Dict[str, Any],
) -> PriceResult:
    baseline_by_variety = config["baseline_price"].get(input_data.variety, config["baseline_price"]["default"])
    baseline_price = float(baseline_by_variety.get(grade, config["baseline_price"]["default"].get(grade, 4.0)))

    channel_coeff = float(config["channel_coeff"].get(input_data.channel, 1.0))
    packaging_coeff = float(config["packaging_coeff"].get(input_data.packaging, 1.0))
    region_coeff = float(config["region_coeff"].get(input_data.region, config["region_coeff"].get("default", 1.0)))
    quality_coeff = _pick_quality_coeff(scores.overall_quality_score, config["quality_coeff"])

    anchor_price = baseline_price * channel_coeff * packaging_coeff * region_coeff * quality_coeff

    retail_cfg = config["price_interval"]["retail"]
    wholesale_cfg = config["price_interval"]["wholesale"]

    retail_min = anchor_price * float(retail_cfg["min_ratio"])
    retail_max = anchor_price * float(retail_cfg["max_ratio"])
    wholesale_min = anchor_price * float(wholesale_cfg["min_ratio"])
    wholesale_max = anchor_price * float(wholesale_cfg["max_ratio"])

    reason = (
        f"以{input_data.variety}{grade}级基准价{baseline_price}元/斤为起点，"
        f"叠加渠道系数{channel_coeff}、包装系数{packaging_coeff}、地区系数{region_coeff}、质量系数{quality_coeff}。"
    )

    factors = {
        "baselinePrice": round(baseline_price, 4),
        "channel": input_data.channel,
        "channelCoeff": round(channel_coeff, 4),
        "packaging": input_data.packaging,
        "packagingCoeff": round(packaging_coeff, 4),
        "region": input_data.region,
        "regionCoeff": round(region_coeff, 4),
        "qualityCoeff": round(quality_coeff, 4),
        "anchorPrice": round(anchor_price, 4),
    }

    return PriceResult(
        retail_min_price=round(retail_min, 2),
        retail_max_price=round(retail_max, 2),
        wholesale_min_price=round(wholesale_min, 2),
        wholesale_max_price=round(wholesale_max, 2),
        factors=factors,
        reason=reason,
    )


def _pick_quality_coeff(overall_quality_score: float, coeffs: Dict[str, float]) -> float:
    if overall_quality_score >= 85:
        return float(coeffs.get("high", 1.05))
    if overall_quality_score >= 72:
        return float(coeffs.get("mid", 1.0))
    return float(coeffs.get("low", 0.95))


# TODO: 后续用区域行情时序模型替代静态地域系数。
