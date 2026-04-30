from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


class FlexiblePayload(BaseModel):
    model_config = ConfigDict(extra="allow")


class DiseasePredictRequest(FlexiblePayload):
    imageUrl: Optional[str] = ""
    batchId: Optional[int] = None
    modelPath: Optional[str] = None


class FruitPredictRequest(FlexiblePayload):
    imageUrl: Optional[str] = ""
    batchId: Optional[int] = None
    channel: Optional[str] = None
    packageType: Optional[str] = None
    region: Optional[str] = None
    diameter: Optional[float] = None
    brix: Optional[float] = None
    weight: Optional[float] = None
    modelPath: Optional[str] = None


class RiskPredictRequest(FlexiblePayload):
    payload: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional nested payload. If omitted, request body itself is treated as risk payload.",
    )


class DiseaseAdviceResult(BaseModel):
    advice: str
    reasoning: str = ""


class FruitVisionResult(BaseModel):
    description: str = ""
    explanation: str = ""
    colorScore: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    defectRatio: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    sizeScore: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    maturityScore: Optional[float] = Field(default=None, ge=0.0, le=100.0)


class RiskExplainResult(BaseModel):
    reason: str = ""
    suggestion: str = ""
    observationFocus: str = ""
