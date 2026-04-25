from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from llm.client import LLMClient
from llm.formatter import maybe_load_json
from llm.prompts import PromptRegistry
from llm.schema import LLMConfig
from llm.tasks import LLMTaskRunner


def _pick_env(*keys: str) -> str:
    for key in keys:
        value = (os.getenv(key) or "").strip()
        if value:
            return value
    return ""


def _load_llm_config(config_path: str) -> LLMConfig:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    data = yaml.safe_load(path.read_text(encoding="utf-8-sig")) or {}
    conf = data.get("llm", data)
    raw_api_key = _pick_env("OPENAI_API_KEY", "DEEPSEEK_API_KEY", "LLM_API_KEY") or str(
        conf.get("api_key", "")
    ).strip()
    if raw_api_key.upper() in {"YOUR_API_KEY", "REPLACE_ME"}:
        raw_api_key = ""

    return LLMConfig(
        base_url=_pick_env("OPENAI_BASE_URL", "DEEPSEEK_BASE_URL", "LLM_BASE_URL")
        or str(conf.get("base_url", "https://api.openai.com")),
        api_key=raw_api_key,
        model=_pick_env("OPENAI_MODEL", "DEEPSEEK_MODEL", "LLM_MODEL")
        or str(conf.get("model", "gpt-4o-mini")),
        chat_path=str(conf.get("chat_path", "/v1/chat/completions")),
        timeout_sec=int(conf.get("timeout_sec", 30)),
        temperature=float(conf.get("temperature", 0.2)),
        max_tokens=int(conf.get("max_tokens", 300)),
    )


def _resolve_prompt_dir(prompt_dir: str) -> str:
    path = Path(prompt_dir)
    if path.is_absolute():
        return str(path)
    return str((PROJECT_ROOT / path).resolve())


def _load_payload(value: str) -> Dict[str, Any]:
    payload = maybe_load_json(value)
    if not isinstance(payload, dict):
        raise ValueError("LLM task payload must be a JSON object")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an LLM task")
    parser.add_argument("--config", default=str(PROJECT_ROOT / "config" / "llm.example.yaml"))
    parser.add_argument("--task", required=True)
    parser.add_argument("--input", default=str(PROJECT_ROOT / "examples" / "llm_task_input.json"))
    parser.add_argument("--prompt-dir", default=str(PROJECT_ROOT / "prompts"))
    args = parser.parse_args()

    llm_config = _load_llm_config(args.config)
    payload = _load_payload(args.input)

    client = LLMClient(llm_config)
    prompt_registry = PromptRegistry(_resolve_prompt_dir(args.prompt_dir))
    runner = LLMTaskRunner(client=client, prompt_registry=prompt_registry)

    result = runner.run(task_name=args.task, payload=payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    # TODO: 后续增加任务重试和本地mock模式，便于离线调试。
    main()
