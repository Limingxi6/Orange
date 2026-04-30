from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict

from llm.client import LLMClient
from llm.formatter import extract_json_object
from llm.prompts import PromptRegistry


SYSTEM_PROMPT = (
    "你是柑橘病害识别解释助手。请给出保守、可执行、避免过度诊断的建议。"
    "当置信度较低时，必须明确写出'不确定，仅供参考'。"
)


@dataclass
class DiseaseLLMExplainResult:
    narrative: str
    advice: str
    need_manual_review: bool
    raw: Dict[str, Any] | None = None


class DiseaseLLMExplainer:
    def __init__(
        self,
        client: LLMClient,
        prompt_registry: PromptRegistry,
        template_name: str = "disease_predict_explain",
    ) -> None:
        self.client = client
        self.prompt_registry = prompt_registry
        self.template_name = template_name

    def _build_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "label": payload.get("label", "unknown"),
            "confidence": payload.get("confidence", 0.0),
            "severity": payload.get("severity", "unknown"),
            "advice": payload.get("advice", ""),
            "needManualReview": payload.get("needManualReview", True),
            "batch_id": payload.get("batch_id", "未提供"),
            "crop_type": payload.get("crop_type", "未提供"),
            "growth_stage": payload.get("growth_stage", "未提供"),
            "weather": payload.get("weather", "未提供"),
            "region": payload.get("region", "未提供"),
        }

    def explain(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        render_payload = self._build_payload(payload)

        user_prompt = self.prompt_registry.render(self.template_name, render_payload)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        text = self.client.chat_text(messages)
        raw_json = extract_json_object(text)

        if raw_json:
            narrative = str(raw_json.get("narrative", "")).strip()
            advice = str(raw_json.get("advice", "")).strip()
            need_manual = bool(raw_json.get("needManualReview", render_payload["needManualReview"]))
        else:
            narrative = text.strip()
            advice = render_payload["advice"]
            need_manual = bool(render_payload["needManualReview"])

        if render_payload["confidence"] < 0.65 and "不确定" not in narrative:
            narrative = f"识别结果不确定，仅供参考。{narrative}".strip()

        if not advice:
            advice = render_payload["advice"]

        result = DiseaseLLMExplainResult(
            narrative=narrative,
            advice=advice,
            need_manual_review=need_manual,
            raw=raw_json,
        )
        return {
            "narrative": result.narrative,
            "advice": result.advice,
            "needManualReview": result.need_manual_review,
            "raw": result.raw,
            "raw_text": text,
        }


def safe_fallback_narrative(payload: Dict[str, Any]) -> str:
    return (
        f"系统识别为{payload.get('label', 'unknown')}，置信度{float(payload.get('confidence', 0.0)):.2f}。"
        f"风险级别{payload.get('severity', 'unknown')}，请结合现场情况谨慎处理。"
    )


# TODO: 后续增加 JSON Schema 校验与响应置信度打分。
