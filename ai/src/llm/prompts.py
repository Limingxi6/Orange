from __future__ import annotations

from pathlib import Path
from typing import Any, Dict


class PromptRegistry:
    def __init__(self, prompt_dir: str) -> None:
        self.prompt_dir = Path(prompt_dir)

    def get_template(self, task_name: str) -> str:
        path = self.prompt_dir / f"{task_name}.txt"
        if not path.exists():
            raise FileNotFoundError(f"Prompt template not found: {path}")
        return path.read_text(encoding="utf-8")

    def render(self, task_name: str, payload: Dict[str, Any]) -> str:
        template = self.get_template(task_name)
        try:
            return template.format(**payload)
        except KeyError as e:
            missing_key = e.args[0]
            raise KeyError(f"Missing prompt variable '{missing_key}' for task '{task_name}'") from e


# TODO: 后续引入模板版本管理与灰度发布机制。
