from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional


def safe_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value)


def extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    raw = safe_text(text)
    if not raw:
        return None

    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass

    first = raw.find("{")
    last = raw.rfind("}")
    if first >= 0 and last > first:
        try:
            obj = json.loads(raw[first : last + 1])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            return None

    return None


def maybe_load_json(value: str) -> Dict[str, Any]:
    path = Path(value)
    if path.exists() and path.is_file():
        return json.loads(path.read_text(encoding="utf-8-sig"))
    return json.loads(value)
