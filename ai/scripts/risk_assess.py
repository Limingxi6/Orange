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
from llm.prompts import PromptRegistry
from llm.schema import LLMConfig
from risk.llm_explainer import RiskLLMExplainer
from risk.service import RiskAssessmentService


def _pick_env(*keys: str) -> str:
    for key in keys:
        value = (os.getenv(key) or "").strip()
        if value:
            return value
    return ""


def _load_json_value(value: str) -> Dict[str, Any]:
    path = Path(value)
    if path.exists() and path.is_file():
        return json.loads(path.read_text(encoding="utf-8-sig"))
    return json.loads(value)


def _normalize_model_path(model_value: str) -> str | None:
    if not model_value:
        return None

    path = Path(model_value)
    if path.is_absolute():
        return str(path)
    return str((PROJECT_ROOT / path).resolve())


def _load_llm_config(config_path: str) -> LLMConfig:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"LLM config not found: {config_path}")

    data = yaml.safe_load(path.read_text(encoding="utf-8-sig")) or {}
    conf = data.get("llm", data)

    api_key = _pick_env("OPENAI_API_KEY", "DEEPSEEK_API_KEY", "LLM_API_KEY") or str(
        conf.get("api_key", "")
    ).strip()
    if api_key.upper() in {"YOUR_API_KEY", "REPLACE_ME"}:
        api_key = ""

    return LLMConfig(
        base_url=_pick_env("OPENAI_BASE_URL", "DEEPSEEK_BASE_URL", "LLM_BASE_URL")
        or str(conf.get("base_url", "https://api.openai.com")),
        api_key=api_key,
        model=_pick_env("OPENAI_MODEL", "DEEPSEEK_MODEL", "LLM_MODEL")
        or str(conf.get("model", "gpt-4o-mini")),
        chat_path=str(conf.get("chat_path", "/v1/chat/completions")),
        timeout_sec=int(conf.get("timeout_sec", 30)),
        temperature=float(conf.get("temperature", 0.2)),
        max_tokens=int(conf.get("max_tokens", 400)),
    )


def _resolve_prompt_dir(value: str) -> str:
    path = Path(value)
    if path.is_absolute():
        return str(path)
    return str((PROJECT_ROOT / path).resolve())


def main() -> None:
    parser = argparse.ArgumentParser(description="Run risk assessment for /api/risk/:batchId")
    parser.add_argument("--input", default=str(PROJECT_ROOT / "examples" / "risk_input.json"))
    parser.add_argument("--model", default="", help="Optional tabular model path (LightGBM/XGBoost/sklearn)")

    parser.add_argument("--with-llm", action="store_true")
    parser.add_argument("--llm-config", default=str(PROJECT_ROOT / "config" / "llm.example.yaml"))
    parser.add_argument("--prompt-dir", default=str(PROJECT_ROOT / "prompts"))
    parser.add_argument("--prompt-template", default="risk_assessment_explain")
    args = parser.parse_args()

    payload = _load_json_value(args.input)
    model_path = _normalize_model_path(args.model)
    if model_path and not Path(model_path).exists():
        model_path = None

    llm_explainer = None
    if args.with_llm:
        llm_cfg = _load_llm_config(args.llm_config)
        if not llm_cfg.api_key:
            raise ValueError("LLM API key is required when --with-llm is enabled")

        client = LLMClient(llm_cfg)
        prompt_registry = PromptRegistry(_resolve_prompt_dir(args.prompt_dir))
        llm_explainer = RiskLLMExplainer(
            client=client,
            prompt_registry=prompt_registry,
            template_name=args.prompt_template,
        )

    service = RiskAssessmentService(model_path=model_path, llm_explainer=llm_explainer)
    result = service.assess(payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
