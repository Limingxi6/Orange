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

from disease.llm_explainer import DiseaseLLMExplainer
from disease.predict import predict_disease
from llm.client import LLMClient
from llm.prompts import PromptRegistry
from llm.schema import LLMConfig


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


def _resolve_image_path(image_path: str, input_value: str) -> str:
    path = Path(image_path)
    if path.is_absolute():
        return str(path)

    input_path = Path(input_value)
    if input_path.exists() and input_path.is_file():
        candidate = (input_path.parent / path).resolve()
        if candidate.exists():
            return str(candidate)

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
        max_tokens=int(conf.get("max_tokens", 300)),
    )


def _resolve_prompt_dir(value: str) -> str:
    path = Path(value)
    if path.is_absolute():
        return str(path)
    return str((PROJECT_ROOT / path).resolve())


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict citrus disease and map to business fields")
    parser.add_argument("--model", default=str(PROJECT_ROOT / "models" / "disease_classifier.pt"))
    parser.add_argument("--image", default="")
    parser.add_argument("--input", default="", help="JSON file path or JSON string")

    parser.add_argument("--batch-id", default="")
    parser.add_argument("--crop-type", default="")
    parser.add_argument("--growth-stage", default="")
    parser.add_argument("--weather", default="")
    parser.add_argument("--region", default="")

    parser.add_argument("--device", default="auto")

    parser.add_argument("--with-llm", action="store_true")
    parser.add_argument("--llm-config", default=str(PROJECT_ROOT / "config" / "llm.example.yaml"))
    parser.add_argument("--prompt-dir", default=str(PROJECT_ROOT / "prompts"))
    parser.add_argument("--prompt-template", default="disease_predict_explain")
    args = parser.parse_args()

    payload: Dict[str, Any] = {}
    if args.input:
        payload = _load_json_value(args.input)

    image_path = args.image or str(payload.get("image_path", ""))
    if not image_path:
        raise ValueError("image path is required, provide --image or --input with image_path")
    image_path = _resolve_image_path(image_path, args.input)

    batch_id = args.batch_id or str(payload.get("batch_id", "")) or None
    crop_type = args.crop_type or str(payload.get("crop_type", "")) or None
    growth_stage = args.growth_stage or str(payload.get("growth_stage", "")) or None
    weather = args.weather or str(payload.get("weather", "")) or None
    region = args.region or str(payload.get("region", "")) or None

    llm_explainer = None
    if args.with_llm:
        llm_cfg = _load_llm_config(args.llm_config)
        if not llm_cfg.api_key:
            raise ValueError("LLM API key is required when --with-llm is enabled")

        client = LLMClient(llm_cfg)
        prompt_registry = PromptRegistry(_resolve_prompt_dir(args.prompt_dir))
        llm_explainer = DiseaseLLMExplainer(
            client=client,
            prompt_registry=prompt_registry,
            template_name=args.prompt_template,
        )

    result = predict_disease(
        image_path=image_path,
        model_path=args.model,
        batch_id=batch_id,
        crop_type=crop_type,
        growth_stage=growth_stage,
        weather=weather,
        region=region,
        llm_explainer=llm_explainer,
        device=args.device,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
