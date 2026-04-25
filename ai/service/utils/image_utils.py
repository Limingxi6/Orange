from __future__ import annotations

import base64
import mimetypes
from pathlib import Path


def resolve_image_url(payload: dict) -> str:
    raw = payload.get("imageUrl") or payload.get("image_url") or payload.get("imagePath") or payload.get("image_path")
    return str(raw or "").strip()


def to_model_image_ref(image_url: str) -> str:
    value = image_url.strip()
    if not value:
        raise ValueError("imageUrl is required")

    if value.startswith("http://") or value.startswith("https://") or value.startswith("data:image/"):
        return value

    candidate = Path(value)
    if not candidate.exists() or not candidate.is_file():
        raise ValueError("imageUrl must be http(s) URL, data URL, or existing local file path")

    mime = mimetypes.guess_type(candidate.name)[0] or "image/jpeg"
    encoded = base64.b64encode(candidate.read_bytes()).decode("utf-8")
    return f"data:{mime};base64,{encoded}"
