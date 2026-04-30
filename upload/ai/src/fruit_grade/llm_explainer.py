from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from llm.client import LLMClient
from llm.formatter import extract_json_object
from llm.prompts import PromptRegistry


SYSTEM_PROMPT = (
    "你是果品分级与价格解释助手。只能基于给定结构化结果做解释，"
    "不得虚构市场数据，不得修改核心计算结果。"
)


@dataclass
class FruitGradeLLMResult:
    narrative: str
    risk_warning: str
    raw: Dict[str, Any] | None


class FruitGradeLLMExplainer:
    def __init__(
        self,
        client: LLMClient,
        prompt_registry: PromptRegistry,
        template_name: str = "fruit_grade_explain",
    ) -> None:
        self.client = client
        self.prompt_registry = prompt_registry
        self.template_name = template_name

    def explain(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        render_payload = {
            "variety": payload.get("variety", "未提供"),
            "grade": payload.get("grade", "未提供"),
            "colorScore": payload.get("colorScore", "未提供"),
            "defectRatio": payload.get("defectRatio", "未提供"),
            "sizeScore": payload.get("sizeScore", "未提供"),
            "maturityScore": payload.get("maturityScore", "未提供"),
            "retailMinPrice": payload.get("retailMinPrice", "未提供"),
            "retailMaxPrice": payload.get("retailMaxPrice", "未提供"),
            "wholesaleMinPrice": payload.get("wholesaleMinPrice", "未提供"),
            "wholesaleMaxPrice": payload.get("wholesaleMaxPrice", "未提供"),
            "channel": payload.get("factors", {}).get("channel", "未提供"),
            "packaging": payload.get("factors", {}).get("packaging", "未提供"),
            "region": payload.get("factors", {}).get("region", "未提供"),
            "reason": payload.get("reason", "未提供"),
            "riskWarning": payload.get("riskWarning", "无"),
            "factors": payload.get("factors", {}),
        }

        user_prompt = self.prompt_registry.render(self.template_name, render_payload)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        text = self.client.chat_text(messages)

        raw_json = extract_json_object(text)
        if raw_json:
            narrative = str(raw_json.get("narrative", "")).strip()
            risk_warning = str(raw_json.get("riskWarning", "")).strip()
        else:
            narrative = text.strip()
            risk_warning = str(payload.get("riskWarning", "")).strip()

        result = FruitGradeLLMResult(
            narrative=narrative,
            risk_warning=risk_warning,
            raw=raw_json,
        )
        return {
            "narrative": result.narrative,
            "riskWarning": result.risk_warning,
            "raw": result.raw,
            "raw_text": text,
        }


# TODO: 后续增加一致性校验，自动比对文案和 factors 是否冲突。
