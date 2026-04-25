from __future__ import annotations

from typing import Dict, Any, List

import requests

from .schema import LLMConfig


class LLMClient:
    """统一 OpenAI-compatible 客户端。"""

    def __init__(self, config: LLMConfig) -> None:
        self.config = config

    def chat(self, messages: List[Dict[str, str]], **kwargs: Any) -> Dict[str, Any]:
        if not self.config.api_key:
            raise ValueError("LLM API key is required")

        url = self._build_chat_url()
        payload = {
            "model": self.config.model,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
        }

        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=self.config.timeout_sec,
        )

        if resp.status_code < 200 or resp.status_code >= 300:
            raise RuntimeError(f"LLM request failed: {resp.status_code} {resp.text}")

        return resp.json()

    def chat_text(self, messages: List[Dict[str, str]], **kwargs: Any) -> str:
        data = self.chat(messages, **kwargs)
        choices = data.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        content = message.get("content", "")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            text = "".join(str(x.get("text", "")) for x in content if isinstance(x, dict))
            return text.strip()
        return ""

    def _build_chat_url(self) -> str:
        base_url = self.config.base_url.rstrip("/")
        chat_path = self.config.chat_path if self.config.chat_path.startswith("/") else f"/{self.config.chat_path}"

        if base_url.lower().endswith("/v1") and chat_path.lower().startswith("/v1/"):
            chat_path = chat_path[3:]

        return f"{base_url}{chat_path}"


# TODO: 后续补充重试、熔断、限流与 token 计量。
