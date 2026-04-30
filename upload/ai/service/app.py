from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from service.settings import ServiceSettings
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from service.predictors import DiseasePredictor, FruitPredictor, RiskPredictor
from service.schemas import DiseasePredictRequest, FruitPredictRequest, RiskPredictRequest


def _to_dict(model_or_dict: Any) -> Dict[str, Any]:
    if isinstance(model_or_dict, dict):
        return model_or_dict
    if hasattr(model_or_dict, "model_dump"):
        return model_or_dict.model_dump(exclude_none=True)
    if hasattr(model_or_dict, "dict"):
        return model_or_dict.dict(exclude_none=True)
    return {}


app = FastAPI(
    title="Orange AI Service",
    version="0.1.0",
    description="Minimal HTTP service for disease/fruit/risk inference with placeholder rules.",
)

disease_predictor = DiseasePredictor()
fruit_predictor = FruitPredictor()
risk_predictor = RiskPredictor(model_path=os.getenv("MODEL_PATH") or None)
settings = ServiceSettings.from_env()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "orange-ai-http",
        "mode": "local-disease-model-primary-plus-llm-advice",
        "externalApiEnabled": settings.external_api_enabled,
        "modelReady": bool(settings.disease_model_path) or (PROJECT_ROOT / "models" / "disease_classifier.pt").exists(),
        "routes": [
            "/predict/disease",
            "/predict/fruit",
            "/predict/risk",
            "/ai/disease/predict",
            "/ai/fruit/perception",
            "/ai/fruit/grade",
        ],
    }


@app.post("/predict/disease")
def predict_disease(payload: DiseasePredictRequest) -> Dict[str, Any]:
    return disease_predictor.predict(_to_dict(payload))


@app.post("/predict/fruit")
def predict_fruit(payload: FruitPredictRequest) -> Dict[str, Any]:
    return fruit_predictor.predict(_to_dict(payload))


@app.post("/predict/risk")
def predict_risk(payload: RiskPredictRequest) -> Dict[str, Any]:
    raw = _to_dict(payload)
    risk_payload = raw.get("payload") if isinstance(raw.get("payload"), dict) else raw
    return risk_predictor.predict(risk_payload)


# Compatibility endpoints for current NestJS clients
@app.post("/ai/disease/predict")
def ai_disease_predict(payload: DiseasePredictRequest) -> Dict[str, Any]:
    return predict_disease(payload)


@app.post("/ai/fruit/grade")
def ai_fruit_grade(payload: FruitPredictRequest) -> Dict[str, Any]:
    return predict_fruit(payload)


@app.post("/ai/fruit/perception")
def ai_fruit_perception(payload: FruitPredictRequest) -> Dict[str, Any]:
    return predict_fruit(payload)


@app.exception_handler(Exception)
def all_exception_handler(_request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_ERROR",
            "message": str(exc),
        },
    )
