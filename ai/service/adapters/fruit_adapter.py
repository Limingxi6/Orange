from __future__ import annotations

from typing import Any, Dict

from service.clients.llm_client import ExternalAPIResponseError, LLMClient
from service.schemas import FruitVisionResult
from service.utils.image_utils import resolve_image_url, to_model_image_ref


SYSTEM_PROMPT = (
    "你是果品视觉分析助手。只能基于图片描述颜色、缺陷、成熟度倾向，"
    "不得输出价格，不得替代本地分级与定价规则。输出必须为JSON对象。"
)


def _prompt(payload: Dict[str, Any]) -> str:
    return (
        "请分析图片并输出 JSON："
        '{"description":"图像观察摘要","explanation":"分级解释建议",'
        '"colorScore":0-100或null,"defectRatio":0-1或null,'
        '"sizeScore":0-100或null,"maturityScore":0-100或null}。'
        f"补充上下文: channel={payload.get('channel','')}, packageType={payload.get('packageType','')}, region={payload.get('region','')}。"
        "如果不确定可返回 null，不要臆造。"
    )


class FruitAdapter:
    def __init__(self, llm_client: LLMClient | None) -> None:
        self.llm_client = llm_client

    def analyze(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.llm_client is None:
            raise ExternalAPIResponseError("External API client is not initialized")

        image_url = resolve_image_url(payload)
        model_image = to_model_image_ref(image_url)
        raw = self.llm_client.vision_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=_prompt(payload),
            image_url=model_image,
        )
        parsed = FruitVisionResult.model_validate(raw)
        return parsed.model_dump(exclude_none=True)
