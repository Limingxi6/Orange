from __future__ import annotations

import json
from typing import Any, Dict

from service.clients.llm_client import ExternalAPIResponseError, LLMClient
from service.schemas import DiseaseAdviceResult


REVIEW_TIP = "当前结果不确定，仅供参考，建议人工复核。"

SYSTEM_PROMPT = (
    "你是农业病虫害建议助手。"
    "只能基于给定的本地模型结构化结果生成建议，不能修改识别结论，不能臆造观察事实。"
    "输出必须是可解析 JSON。"
)


def _prompt(payload: Dict[str, Any]) -> str:
    confidence = float(payload.get("confidence", 0.0))
    low_conf_hint = (
        f"当 confidence < 0.65 时，advice 与 reasoning 必须包含：{REVIEW_TIP}"
        if confidence < 0.65
        else "如有不确定性，也需明确建议人工复核。"
    )
    input_payload = {
        "cropType": payload.get("cropType"),
        "label": payload.get("label"),
        "confidence": confidence,
        "severity": payload.get("severity"),
        "needManualReview": payload.get("needManualReview"),
        "region": payload.get("region"),
        "growthStage": payload.get("growthStage"),
        "weather": payload.get("weather"),
    }

    return (
        "请基于本地病虫害识别结果生成农户可执行建议。"
        "严格输出 JSON，仅允许字段 advice 和 reasoning。"
        "\nJSON schema: {\"advice\": string, \"reasoning\": string}"
        f"\n输入: {json.dumps(input_payload, ensure_ascii=False)}"
        f"\n约束: {low_conf_hint}"
    )


class DiseaseAdapter:
    def __init__(self, llm_client: LLMClient | None) -> None:
        self.llm_client = llm_client

    def generate_advice(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.llm_client is None:
            raise ExternalAPIResponseError("External API client is not initialized")

        raw = self.llm_client.text_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=_prompt(payload),
        )
        parsed = DiseaseAdviceResult.model_validate(raw)

        advice = parsed.advice.strip()
        reasoning = parsed.reasoning.strip()

        confidence = float(payload.get("confidence", 0.0))
        if confidence < 0.65:
            if REVIEW_TIP not in advice:
                advice = f"{REVIEW_TIP}{advice}".strip()
            if REVIEW_TIP not in reasoning:
                reasoning = f"{REVIEW_TIP}{reasoning}".strip()

        return {
            "advice": advice,
            "reasoning": reasoning,
        }
