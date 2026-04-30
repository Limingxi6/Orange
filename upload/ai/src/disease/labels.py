from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

import yaml


MVP_DISEASE_LABELS = [
    "normal",
    "canker",
    "anthracnose",
    "mite",
]


@dataclass
class LabelMapping:
    label_to_id: Dict[str, int]
    id_to_label: Dict[int, str]

    @property
    def labels(self) -> List[str]:
        return [self.id_to_label[idx] for idx in range(len(self.id_to_label))]

    def encode(self, label: str) -> int:
        normalized = normalize_label(label)
        if normalized not in self.label_to_id:
            raise KeyError(f"Unknown label: {label}")
        return self.label_to_id[normalized]

    def decode(self, label_id: int) -> str:
        if label_id not in self.id_to_label:
            raise KeyError(f"Unknown label id: {label_id}")
        return self.id_to_label[label_id]

    def to_dict(self) -> Dict[str, Dict[str, Any]]:
        return {
            "label_to_id": self.label_to_id,
            "id_to_label": {str(k): v for k, v in self.id_to_label.items()},
            "labels": self.labels,
        }


def normalize_label(label: str) -> str:
    return str(label).strip().lower().replace(" ", "_")


def build_label_mapping(labels: List[str] | None = None) -> LabelMapping:
    normalized = [normalize_label(x) for x in (labels or MVP_DISEASE_LABELS)]
    uniq = list(dict.fromkeys(normalized))
    label_to_id = {name: idx for idx, name in enumerate(uniq)}
    id_to_label = {idx: name for name, idx in label_to_id.items()}
    return LabelMapping(label_to_id=label_to_id, id_to_label=id_to_label)


def _read_config(path: Path) -> Any:
    text = path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() in {".yaml", ".yml"}:
        return yaml.safe_load(text)
    return json.loads(text)


def load_label_mapping(labels_path: str | None = None) -> LabelMapping:
    if not labels_path:
        return build_label_mapping()

    path = Path(labels_path)
    if not path.exists():
        raise FileNotFoundError(f"Labels file not found: {labels_path}")

    raw = _read_config(path)

    if isinstance(raw, list):
        return build_label_mapping([str(x) for x in raw])

    if isinstance(raw, dict):
        if "labels" in raw and isinstance(raw["labels"], list):
            return build_label_mapping([str(x) for x in raw["labels"]])
        if "label_to_id" in raw and isinstance(raw["label_to_id"], dict):
            label_to_id = {
                normalize_label(label): int(idx)
                for label, idx in raw["label_to_id"].items()
            }
            id_to_label = {idx: label for label, idx in label_to_id.items()}
            return LabelMapping(label_to_id=label_to_id, id_to_label=id_to_label)
        if all(isinstance(v, int) for v in raw.values()):
            label_to_id = {normalize_label(k): int(v) for k, v in raw.items()}
            id_to_label = {idx: label for label, idx in label_to_id.items()}
            return LabelMapping(label_to_id=label_to_id, id_to_label=id_to_label)

    raise ValueError("Unsupported labels file format. Expected list or dict.")


def save_label_mapping(path: str, mapping: LabelMapping) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(mapping.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
