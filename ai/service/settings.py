from __future__ import annotations

import os
from dataclasses import dataclass


def _to_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_float(value: str | None, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _first_non_empty_env(keys: tuple[str, ...]) -> str:
    for key in keys:
        value = (os.getenv(key) or "").strip()
        if value:
            return value
    return ""


@dataclass(frozen=True)
class ServiceSettings:
    openai_api_key: str
    openai_base_url: str | None
    openai_model: str
    openai_timeout_ms: int
    openai_max_retries: int
    disease_model_path: str | None
    disease_label_map_path: str | None
    disease_low_confidence_threshold: float
    disease_model_version: str
    fruit_grade_model_path: str | None

    @classmethod
    def from_env(cls) -> "ServiceSettings":
        model_path = (
            (os.getenv("DISEASE_MODEL_PATH") or "").strip()
            or (os.getenv("MODEL_PATH") or "").strip()
            or None
        )
        fruit_model_path = (os.getenv("FRUIT_GRADE_MODEL_PATH") or "").strip() or None
        label_map_path = (os.getenv("DISEASE_LABEL_MAP_PATH") or "").strip() or None
        low_conf_threshold = _to_float(os.getenv("DISEASE_LOW_CONFIDENCE_THRESHOLD"), 0.65)
        model_version = (os.getenv("DISEASE_MODEL_VERSION") or "local-model-v1").strip()
        return cls(
            openai_api_key=_first_non_empty_env(("OPENAI_API_KEY", "DEEPSEEK_API_KEY", "LLM_API_KEY")),
            openai_base_url=_first_non_empty_env(
                ("OPENAI_BASE_URL", "DEEPSEEK_BASE_URL", "LLM_BASE_URL")
            )
            or None,
            openai_model=_first_non_empty_env(("OPENAI_MODEL", "DEEPSEEK_MODEL", "LLM_MODEL"))
            or "gpt-4o-mini",
            openai_timeout_ms=max(
                1000,
                _to_int(
                    _first_non_empty_env(
                        ("OPENAI_TIMEOUT_MS", "DEEPSEEK_TIMEOUT_MS", "LLM_TIMEOUT_MS")
                    )
                    or None,
                    15000,
                ),
            ),
            openai_max_retries=max(
                0,
                _to_int(
                    _first_non_empty_env(
                        ("OPENAI_MAX_RETRIES", "DEEPSEEK_MAX_RETRIES", "LLM_MAX_RETRIES")
                    )
                    or None,
                    2,
                ),
            ),
            disease_model_path=model_path,
            disease_label_map_path=label_map_path,
            disease_low_confidence_threshold=max(0.0, min(1.0, low_conf_threshold)),
            disease_model_version=model_version,
            fruit_grade_model_path=fruit_model_path,
        )

    @property
    def external_api_enabled(self) -> bool:
        return bool(self.openai_api_key)
