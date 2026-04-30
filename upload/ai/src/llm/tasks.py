from __future__ import annotations

from typing import Any, Dict

from .client import LLMClient
from .formatter import extract_json_object
from .prompts import PromptRegistry
from .schema import LLMTaskResult, SUPPORTED_TASKS


SYSTEM_PROMPTS = {
    "explain_disease_result": "你是柑橘病害专家，请给出准确、可执行的解释。",
    "generate_farming_advice": "你是农事管理助手，请输出可执行建议。",
    "explain_risk_result": "你是农业风险分析助手，请解释风险并提供处置建议。",
    "generate_trace_summary": "你是农产品溯源文案助手，请输出客观可信摘要。",
    "answer_agri_question": "你是农业问答助手，请先结论后步骤。",
}


def _run_task(
    client: LLMClient,
    prompt_registry: PromptRegistry,
    task_name: str,
    payload: Dict[str, Any],
) -> LLMTaskResult:
    if task_name not in SUPPORTED_TASKS:
        raise ValueError(f"Unsupported task: {task_name}")

    user_prompt = prompt_registry.render(task_name, payload)
    system_prompt = SYSTEM_PROMPTS[task_name]

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    text = client.chat_text(messages)
    raw = extract_json_object(text)
    return LLMTaskResult(task=task_name, text=text, raw=raw)


def explain_disease_result(
    client: LLMClient,
    prompt_registry: PromptRegistry,
    payload: Dict[str, Any],
) -> LLMTaskResult:
    return _run_task(client, prompt_registry, "explain_disease_result", payload)


def generate_farming_advice(
    client: LLMClient,
    prompt_registry: PromptRegistry,
    payload: Dict[str, Any],
) -> LLMTaskResult:
    return _run_task(client, prompt_registry, "generate_farming_advice", payload)


def explain_risk_result(
    client: LLMClient,
    prompt_registry: PromptRegistry,
    payload: Dict[str, Any],
) -> LLMTaskResult:
    return _run_task(client, prompt_registry, "explain_risk_result", payload)


def generate_trace_summary(
    client: LLMClient,
    prompt_registry: PromptRegistry,
    payload: Dict[str, Any],
) -> LLMTaskResult:
    return _run_task(client, prompt_registry, "generate_trace_summary", payload)


def answer_agri_question(
    client: LLMClient,
    prompt_registry: PromptRegistry,
    payload: Dict[str, Any],
) -> LLMTaskResult:
    return _run_task(client, prompt_registry, "answer_agri_question", payload)


TASK_DISPATCHER = {
    "explain_disease_result": explain_disease_result,
    "generate_farming_advice": generate_farming_advice,
    "explain_risk_result": explain_risk_result,
    "generate_trace_summary": generate_trace_summary,
    "answer_agri_question": answer_agri_question,
}


class LLMTaskRunner:
    def __init__(self, client: LLMClient, prompt_registry: PromptRegistry) -> None:
        self.client = client
        self.prompt_registry = prompt_registry

    def run(self, task_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        fn = TASK_DISPATCHER.get(task_name)
        if fn is None:
            raise ValueError(f"Unsupported task: {task_name}")
        result = fn(self.client, self.prompt_registry, payload)
        return {
            "task": result.task,
            "text": result.text,
            "raw": result.raw,
        }


# TODO: 后续加入任务级 prompt 版本号与输出质量评估打分。
