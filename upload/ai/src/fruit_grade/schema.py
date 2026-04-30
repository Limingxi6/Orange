from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class FruitGradeInput:
    image_path: str
    variety: str = "纽荷尔脐橙"
    channel: str = "ecommerce"
    packaging: str = "simple"
    region: str = "湖北宜昌"
    brix: Optional[float] = None
    diameter_mm: Optional[float] = None
    weight_g: Optional[float] = None


@dataclass
class FruitQualityScores:
    color_score: float
    defect_ratio: float
    size_score: float
    maturity_score: float
    overall_quality_score: float


@dataclass
class FruitGradeResult:
    variety: str
    grade: str
    color_score: float
    defect_ratio: float
    size_score: float
    maturity_score: float
    retail_min_price: float
    retail_max_price: float
    wholesale_min_price: float
    wholesale_max_price: float
    reason: str
    risk_warning: str
    factors: Dict[str, Any] = field(default_factory=dict)
    llm_narrative: Optional[str] = None

    def to_api_dict(self) -> Dict[str, Any]:
        output = {
            "variety": self.variety,
            "grade": self.grade,
            "colorScore": round(float(self.color_score), 2),
            "defectRatio": round(float(self.defect_ratio), 4),
            "sizeScore": round(float(self.size_score), 2),
            "maturityScore": round(float(self.maturity_score), 2),
            "retailMinPrice": round(float(self.retail_min_price), 2),
            "retailMaxPrice": round(float(self.retail_max_price), 2),
            "wholesaleMinPrice": round(float(self.wholesale_min_price), 2),
            "wholesaleMaxPrice": round(float(self.wholesale_max_price), 2),
            "reason": self.reason,
            "riskWarning": self.risk_warning,
            "factors": self.factors,
        }
        if self.llm_narrative:
            output["llmNarrative"] = self.llm_narrative
        return output


def parse_fruit_input(payload: Dict[str, Any]) -> FruitGradeInput:
    image_path = payload.get("image_path") or payload.get("imagePath")
    if not image_path:
        raise ValueError("image_path is required")

    return FruitGradeInput(
        image_path=str(image_path),
        variety=str(payload.get("variety", "纽荷尔脐橙")),
        channel=str(payload.get("channel", "ecommerce")),
        packaging=str(payload.get("packaging", payload.get("packageType", "simple"))),
        region=str(payload.get("region", "湖北宜昌")),
        brix=_to_float(payload.get("brix")),
        diameter_mm=_to_float(payload.get("diameter_mm", payload.get("diameterMm", payload.get("diameter")))),
        weight_g=_to_float(payload.get("weight_g", payload.get("weightG", payload.get("weight")))),
    )


def _to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    return float(value)
