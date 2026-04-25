from __future__ import annotations

import json
import logging
from typing import Any, Dict

from service.settings import ServiceSettings

try:
    from openai import APIConnectionError, APIError, APITimeoutError, OpenAI
except Exception:  # pragma: no cover - import guard for environments without dependency
    OpenAI = None  # type: ignore[assignment]
    APIError = Exception  # type: ignore[assignment]
    APIConnectionError = Exception  # type: ignore[assignment]
    APITimeoutError = Exception  # type: ignore[assignment]


logger = logging.getLogger(__name__)


class ExternalAPIError(RuntimeError):
    pass


class ExternalAPIResponseError(ExternalAPIError):
    pass


class ExternalAPIRequestError(ExternalAPIError):
    pass


class LLMClient:
    def __init__(self, settings: ServiceSettings) -> None:
        if OpenAI is None:
            raise ExternalAPIRequestError("openai package is not installed")
        if not settings.external_api_enabled:
            raise ExternalAPIRequestError(
                "OPENAI_API_KEY (or DEEPSEEK_API_KEY / LLM_API_KEY) is required"
            )

        self.settings = settings
        self.client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=max(1.0, settings.openai_timeout_ms / 1000.0),
            max_retries=settings.openai_max_retries,
        )

    def vision_json(self, *, system_prompt: str, user_prompt: str, image_url: str) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ]
        return self._chat_json(messages)

    def text_json(self, *, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self._chat_json(messages)

    def _chat_json(self, messages: list[dict[str, Any]]) -> Dict[str, Any]:
        try:
            resp = self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=messages,
                temperature=0.1,
                response_format={"type": "json_object"},
            )
        except (APITimeoutError, APIConnectionError, APIError) as exc:
            logger.warning("External API request failed: %s", self._sanitize(str(exc)))
            raise ExternalAPIRequestError(str(exc)) from exc
        except Exception as exc:  # pragma: no cover - SDK behavior differences
            logger.warning("External API unexpected failure: %s", self._sanitize(str(exc)))
            raise ExternalAPIRequestError(str(exc)) from exc

        text = self._extract_text(resp)
        data = self._parse_json(text)
        if data is None:
            logger.warning("External API returned non-JSON content: %s", self._sanitize(text))
            raise ExternalAPIResponseError("External API returned non-JSON output")
        return data

    def _extract_text(self, resp: Any) -> str:
        choices = getattr(resp, "choices", None) or []
        if not choices:
            raise ExternalAPIResponseError("No choices in external API response")

        message = getattr(choices[0], "message", None)
        content = getattr(message, "content", None) if message is not None else None

        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    maybe_text = item.get("text")
                    if isinstance(maybe_text, str):
                        parts.append(maybe_text)
            return "".join(parts).strip()
        return ""

    def _parse_json(self, text: str) -> Dict[str, Any] | None:
        if not text:
            return None
        try:
            data = json.loads(text)
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start < 0 or end <= start:
                return None
            try:
                data = json.loads(text[start : end + 1])
                return data if isinstance(data, dict) else None
            except json.JSONDecodeError:
                return None

    def _sanitize(self, text: str) -> str:
        redacted = text.replace(self.settings.openai_api_key, "***")
        return redacted[:600]
