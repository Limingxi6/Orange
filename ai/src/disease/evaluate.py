from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from torch.utils.data import DataLoader

from .dataset import (
    DiseaseImageDataset,
    build_transforms,
    filter_missing_samples,
    load_disease_samples,
    split_samples,
)
from .labels import LabelMapping
from .model_factory import create_backbone


def resolve_device(device: str) -> str:
    if device != "auto":
        return device
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_checkpoint_bundle(model_path: str, device: str = "auto") -> Dict[str, Any]:
    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {model_path}")
    return torch.load(path, map_location=resolve_device(device))


def _build_label_mapping(bundle: Dict[str, Any]) -> LabelMapping:
    label_to_id = {str(k): int(v) for k, v in bundle["label_to_id"].items()}
    id_to_label = {int(k): str(v) for k, v in bundle["id_to_label"].items()}
    return LabelMapping(label_to_id=label_to_id, id_to_label=id_to_label)


def _predict(
    model: torch.nn.Module,
    loader: DataLoader,
    device: str,
) -> Tuple[List[int], List[int]]:
    model.eval()
    y_true: List[int] = []
    y_pred: List[int] = []

    with torch.no_grad():
        for images, targets, _ in loader:
            images = images.to(device)
            targets = targets.to(device)

            logits = model(images)
            preds = torch.argmax(logits, dim=1)

            y_true.extend(targets.cpu().tolist())
            y_pred.extend(preds.cpu().tolist())

    return y_true, y_pred


def _compute_metrics(y_true: List[int], y_pred: List[int]) -> Dict[str, Any]:
    if not y_true:
        return {
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
        }

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true,
        y_pred,
        average="macro",
        zero_division=0,
    )
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
    }


def evaluate_disease_model(
    model_path: str,
    source: str,
    source_type: str = "csv",
    image_root: str | None = None,
    split: str = "test",
    batch_size: int = 16,
    num_workers: int = 0,
    device: str = "auto",
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_seed: int = 42,
) -> Dict[str, Any]:
    bundle = load_checkpoint_bundle(model_path=model_path, device=device)
    runtime_device = resolve_device(device)

    label_mapping = _build_label_mapping(bundle)
    image_size = int(bundle.get("image_size", 224))

    samples = load_disease_samples(
        source=source,
        source_type=source_type,
        image_root=image_root,
        val_ratio=val_ratio,
        test_ratio=test_ratio,
        seed=random_seed,
    )
    samples, missing_count = filter_missing_samples(samples)
    split_dict = split_samples(samples)

    target_split = split.strip().lower()
    if target_split not in split_dict:
        raise ValueError(f"Unsupported split: {split}")

    selected = split_dict[target_split]
    if not selected:
        raise ValueError(f"Split '{target_split}' has no valid samples")

    _, eval_tf = build_transforms(image_size=image_size, augment=False)
    dataset = DiseaseImageDataset(selected, label_mapping=label_mapping, transform=eval_tf)
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    model = create_backbone(bundle["backbone"], num_classes=len(label_mapping.labels), pretrained=False)
    model.load_state_dict(bundle["state_dict"])
    model.to(runtime_device)

    y_true, y_pred = _predict(model=model, loader=loader, device=runtime_device)
    metrics = _compute_metrics(y_true, y_pred)

    return {
        "split": target_split,
        "metrics": metrics,
        "num_samples": len(selected),
        "missing_images": missing_count,
        "backbone": bundle["backbone"],
        "model_path": str(Path(model_path).resolve()),
    }


if __name__ == "__main__":
    # TODO: 后续补充混淆矩阵和错误样本导出能力。
    result = evaluate_disease_model(
        model_path="./models/disease_classifier_leaves.pt",
        source="./data/disease_labels.sample.csv",
        source_type="csv",
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
