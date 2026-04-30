from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from torch.utils.data import DataLoader
from tqdm import tqdm

from .dataset import (
    DiseaseImageDataset,
    IMAGENET_MEAN,
    IMAGENET_STD,
    build_transforms,
    ensure_label_mapping,
    filter_missing_samples,
    load_disease_samples,
    split_samples,
)
from .labels import LabelMapping, load_label_mapping, save_label_mapping
from .model_factory import create_backbone


@dataclass
class TrainConfig:
    source: str
    source_type: str = "csv"
    image_root: str | None = None
    labels_path: str | None = None
    output_checkpoint_path: str = "./models/disease_classifier_leaves.pt"
    output_label_map_path: str = "./models/disease_label_mapping.json"
    backbone: str = "mobilenet_v3_small"
    pretrained: bool = False
    image_size: int = 224
    epochs: int = 8
    batch_size: int = 16
    learning_rate: float = 1e-3
    weight_decay: float = 1e-4
    num_workers: int = 0
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    random_seed: int = 42
    device: str = "auto"
    use_augmentation: bool = True


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def resolve_device(device: str) -> str:
    if device != "auto":
        return device
    return "cuda" if torch.cuda.is_available() else "cpu"


def _build_dataloaders(
    cfg: TrainConfig,
    label_mapping: LabelMapping,
    split_dict: Dict[str, List],
) -> Dict[str, DataLoader]:
    train_tf, eval_tf = build_transforms(image_size=cfg.image_size, augment=cfg.use_augmentation)

    train_dataset = DiseaseImageDataset(split_dict["train"], label_mapping=label_mapping, transform=train_tf)
    val_dataset = DiseaseImageDataset(split_dict["val"], label_mapping=label_mapping, transform=eval_tf)
    test_dataset = DiseaseImageDataset(split_dict["test"], label_mapping=label_mapping, transform=eval_tf)

    return {
        "train": DataLoader(
            train_dataset,
            batch_size=cfg.batch_size,
            shuffle=True,
            num_workers=cfg.num_workers,
            pin_memory=torch.cuda.is_available(),
        ),
        "val": DataLoader(
            val_dataset,
            batch_size=cfg.batch_size,
            shuffle=False,
            num_workers=cfg.num_workers,
            pin_memory=torch.cuda.is_available(),
        ),
        "test": DataLoader(
            test_dataset,
            batch_size=cfg.batch_size,
            shuffle=False,
            num_workers=cfg.num_workers,
            pin_memory=torch.cuda.is_available(),
        ),
    }


def _collect_predictions(
    model: nn.Module,
    loader: DataLoader,
    device: str,
) -> Tuple[List[int], List[int], float]:
    model.eval()
    criterion = nn.CrossEntropyLoss()

    losses: List[float] = []
    y_true: List[int] = []
    y_pred: List[int] = []

    with torch.no_grad():
        for images, targets, _ in loader:
            images = images.to(device)
            targets = targets.to(device)

            logits = model(images)
            loss = criterion(logits, targets)

            preds = torch.argmax(logits, dim=1)
            losses.append(float(loss.item()))
            y_true.extend(targets.cpu().tolist())
            y_pred.extend(preds.cpu().tolist())

    avg_loss = float(np.mean(losses)) if losses else 0.0
    return y_true, y_pred, avg_loss


def compute_metrics(y_true: List[int], y_pred: List[int]) -> Dict[str, float]:
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


def _train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    device: str,
) -> Dict[str, float]:
    model.train()
    criterion = nn.CrossEntropyLoss()

    losses: List[float] = []
    y_true: List[int] = []
    y_pred: List[int] = []

    progress = tqdm(loader, desc="train", leave=False)
    for images, targets, _ in progress:
        images = images.to(device)
        targets = targets.to(device)

        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, targets)
        loss.backward()
        optimizer.step()

        preds = torch.argmax(logits, dim=1)
        losses.append(float(loss.item()))
        y_true.extend(targets.cpu().tolist())
        y_pred.extend(preds.cpu().tolist())

    metrics = compute_metrics(y_true, y_pred)
    metrics["loss"] = float(np.mean(losses)) if losses else 0.0
    return metrics


def _validate(
    model: nn.Module,
    loader: DataLoader,
    device: str,
) -> Dict[str, float]:
    y_true, y_pred, avg_loss = _collect_predictions(model, loader, device=device)
    metrics = compute_metrics(y_true, y_pred)
    metrics["loss"] = avg_loss
    return metrics


def _save_best_checkpoint(
    cfg: TrainConfig,
    model: nn.Module,
    label_mapping: LabelMapping,
    best_metrics: Dict[str, float],
    dataset_stats: Dict[str, Any],
) -> str:
    output = Path(cfg.output_checkpoint_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "state_dict": model.state_dict(),
        "backbone": cfg.backbone,
        "label_to_id": label_mapping.label_to_id,
        "id_to_label": label_mapping.id_to_label,
        "image_size": cfg.image_size,
        "normalize_mean": IMAGENET_MEAN,
        "normalize_std": IMAGENET_STD,
        "best_metrics": best_metrics,
        "dataset_stats": dataset_stats,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "train_config": asdict(cfg),
    }

    torch.save(payload, output)
    save_label_mapping(cfg.output_label_map_path, label_mapping)
    return str(output)


def train_disease_model(cfg: TrainConfig) -> Dict[str, Any]:
    set_seed(cfg.random_seed)
    device = resolve_device(cfg.device)

    raw_samples = load_disease_samples(
        source=cfg.source,
        source_type=cfg.source_type,
        image_root=cfg.image_root,
        val_ratio=cfg.val_ratio,
        test_ratio=cfg.test_ratio,
        seed=cfg.random_seed,
    )

    samples, missing_count = filter_missing_samples(raw_samples)
    if not samples:
        raise ValueError("No valid image samples were found. Check source paths.")

    label_mapping = ensure_label_mapping(
        samples,
        mapping=load_label_mapping(cfg.labels_path) if cfg.labels_path else None,
    )
    split_dict = split_samples(samples)

    if not split_dict["train"]:
        raise ValueError("Training split is empty. Provide train samples via directory or CSV split.")

    if not split_dict["val"]:
        # TODO: 后续增加更严格的分层策略；当前MVP先回退到test或train评估。
        split_dict["val"] = split_dict["test"] if split_dict["test"] else split_dict["train"]

    loaders = _build_dataloaders(cfg, label_mapping=label_mapping, split_dict=split_dict)

    model = create_backbone(cfg.backbone, num_classes=len(label_mapping.labels), pretrained=cfg.pretrained)
    model.to(device)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=cfg.learning_rate,
        weight_decay=cfg.weight_decay,
    )

    best_f1 = -1.0
    best_metrics: Dict[str, float] = {}
    history: List[Dict[str, Any]] = []

    for epoch in range(1, cfg.epochs + 1):
        train_metrics = _train_one_epoch(model, loaders["train"], optimizer, device=device)
        val_metrics = _validate(model, loaders["val"], device=device)

        epoch_record = {
            "epoch": epoch,
            "train": train_metrics,
            "val": val_metrics,
        }
        history.append(epoch_record)

        if val_metrics["f1"] > best_f1:
            best_f1 = val_metrics["f1"]
            best_metrics = {
                "epoch": epoch,
                **val_metrics,
            }
            _save_best_checkpoint(
                cfg,
                model=model,
                label_mapping=label_mapping,
                best_metrics=best_metrics,
                dataset_stats={
                    "train_size": len(split_dict["train"]),
                    "val_size": len(split_dict["val"]),
                    "test_size": len(split_dict["test"]),
                    "missing_images": missing_count,
                },
            )

    test_metrics: Dict[str, float] | None = None
    if split_dict["test"]:
        ckpt = torch.load(cfg.output_checkpoint_path, map_location=device)
        model.load_state_dict(ckpt["state_dict"])
        test_metrics = _validate(model, loaders["test"], device=device)

    output = {
        "checkpoint_path": str(Path(cfg.output_checkpoint_path).resolve()),
        "label_map_path": str(Path(cfg.output_label_map_path).resolve()),
        "backbone": cfg.backbone,
        "device": device,
        "best_val": best_metrics,
        "test": test_metrics,
        "dataset": {
            "train_size": len(split_dict["train"]),
            "val_size": len(split_dict["val"]),
            "test_size": len(split_dict["test"]),
            "missing_images": missing_count,
            "num_classes": len(label_mapping.labels),
        },
        "history": history,
    }
    return output


def train_from_yaml(config_path: str) -> Dict[str, Any]:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Training config not found: {config_path}")

    data = json.loads(path.read_text(encoding="utf-8-sig")) if path.suffix.lower() == ".json" else None
    if data is None:
        import yaml

        data = yaml.safe_load(path.read_text(encoding="utf-8-sig"))

    if "train" in data:
        data = data["train"]

    cfg = TrainConfig(**data)
    return train_disease_model(cfg)


if __name__ == "__main__":
    # TODO: 后续接入混合精度训练与早停策略。
    sample_cfg = TrainConfig(
        source="./data/disease_labels.sample.csv",
        source_type="csv",
        output_checkpoint_path="./models/disease_classifier_leaves.pt",
    )
    print(json.dumps(train_disease_model(sample_cfg), ensure_ascii=False, indent=2))
