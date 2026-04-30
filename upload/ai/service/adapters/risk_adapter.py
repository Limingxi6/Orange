from __future__ import annotations

import json
from typing import Any, Dict

from service.clients.llm_client import ExternalAPIResponseError, LLMClient
from service.schemas import RiskExplainResult


SYSTEM_PROMPT = (
    "你是农业风险解释助手。只能基于给定规则结果润色原因与建议，"
    "不得更改风险等级，不得臆造监测数据。输出必须为JSON对象。"
)


def _prompt(payload: Dict[str, Any]) -> str:
    return (
        "基于输入做中文简洁改写，输出 JSON："
        '{"reason":"润色后的原因","suggestion":"可执行建议","observationFocus":"可选观察重点"}。'
        "不得修改 level/levelText。输入如下：\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )


class RiskAdapter:
    def __init__(self, llm_client: LLMClient | None) -> None:
        self.llm_client = llm_client

    def explain(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.llm_client is None:
            raise ExternalAPIResponseError("External API client is not initialized")

        raw = self.llm_client.text_json(system_prompt=SYSTEM_PROMPT, user_prompt=_prompt(payload))
        parsed = RiskExplainResult.model_validate(raw)
        return parsed.model_dump()
