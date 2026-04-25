from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class LLMConfig:
    base_url: str
    api_key: str
    model: str
    chat_path: str = "/v1/chat/completions"
    timeout_sec: int = 30
    temperature: float = 0.2
    max_tokens: int = 300


@dataclass
class LLMMessage:
    role: str
    content: str


@dataclass
class LLMTaskResult:
    task: str
    text: str
    raw: Dict[str, Any] | None = None


SUPPORTED_TASKS: List[str] = [
    "explain_disease_result",
    "generate_farming_advice",
    "explain_risk_result",
    "generate_trace_summary",
    "answer_agri_question",
]
