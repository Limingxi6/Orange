from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from llm.client import LLMClient
from llm.formatter import extract_json_object
from llm.prompts import PromptRegistry


SYSTEM_PROMPT = (
    "你是农业风险解读助手。只能基于提供的结构化信息解释风险，不得虚构监测数据，"
    "不得更改给定风险等级。建议需要保守、明确、可执行。"
)


@dataclass
class RiskLLMExplainResult:
    reason: str
    suggestion: str
    observation_focus: str
    raw: Dict[str, Any] | None


class RiskLLMExplainer:
    def __init__(
        self,
        client: LLMClient,
        prompt_registry: PromptRegistry,
        template_name: str = "risk_assessment_explain",
    ) -> None:
        self.client = client
        self.prompt_registry = prompt_registry
        self.template_name = template_name

    def explain(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        render_payload = {
            "level": payload.get("level", "low"),
            "levelText": payload.get("levelText", "低"),
            "ruleHits": payload.get("ruleHits", []),
            "weatherSummary": payload.get("weatherSummary", "未提供"),
            "diseaseSummary": payload.get("diseaseSummary", "未提供"),
            "farmingSummary": payload.get("farmingSummary", "未提供"),
            "stage": payload.get("stage", "未提供"),
            "reason": payload.get("reason", ""),
            "suggestion": payload.get("suggestion", ""),
        }

        user_prompt = self.prompt_registry.render(self.template_name, render_payload)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        text = self.client.chat_text(messages)

        raw_json = extract_json_object(text)
        if raw_json:
            reason = str(raw_json.get("reason", "")).strip()
            suggestion = str(raw_json.get("suggestion", "")).strip()
            observation_focus = str(raw_json.get("observationFocus", "")).strip()
        else:
            reason = text.strip()
            suggestion = str(payload.get("suggestion", "")).strip()
            observation_focus = ""

        if not reason:
            reason = str(payload.get("reason", "")).strip()
        if not suggestion:
            suggestion = str(payload.get("suggestion", "")).strip()

        result = RiskLLMExplainResult(
            reason=reason,
            suggestion=suggestion,
            observation_focus=observation_focus,
            raw=raw_json,
        )
        return {
            "reason": result.reason,
            "suggestion": result.suggestion,
            "observationFocus": result.observation_focus,
            "raw": result.raw,
            "raw_text": text,
        }


# TODO: 后续增加输出一致性校验，避免建议与规则命中冲突。
