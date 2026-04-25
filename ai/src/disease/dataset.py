from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Literal, Sequence, Tuple

import pandas as pd
import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

from .labels import LabelMapping, build_label_mapping, normalize_label


ImageSplit = Literal["train", "val", "test"]
VALID_SPLITS = {"train", "val", "test"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


@dataclass
class DiseaseSample:
    image_path: str
    label: str
    split: ImageSplit


def _is_image_file(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_EXTS


def _normalize_split(value: str) -> str:
    return str(value or "").strip().lower()


def _list_images(folder: Path) -> List[Path]:
    files = [x for x in folder.iterdir() if x.is_file() and _is_image_file(x)]
    files.sort(key=lambda p: p.name)
    return files


def _split_by_ratio(
    image_paths: Sequence[Path],
    val_ratio: float,
    test_ratio: float,
    seed: int,
) -> Dict[str, List[Path]]:
    if not image_paths:
        return {"train": [], "val": [], "test": []}

    rng = random.Random(seed)
    items = list(image_paths)
    rng.shuffle(items)

    n = len(items)
    n_test = int(round(n * test_ratio))
    n_val = int(round(n * val_ratio))

    if n >= 3 and n_test == 0 and test_ratio > 0:
        n_test = 1
    if n >= 3 and n_val == 0 and val_ratio > 0:
        n_val = 1

    if n_test + n_val >= n:
        overflow = (n_test + n_val) - (n - 1)
        if overflow > 0 and n_val >= overflow:
            n_val -= overflow
        elif overflow > 0:
            n_test = max(0, n_test - (overflow - n_val))
            n_val = 0

    test_items = items[:n_test]
    val_items = items[n_test : n_test + n_val]
    train_items = items[n_test + n_val :]

    return {
        "train": train_items,
        "val": val_items,
        "test": test_items,
    }


def load_samples_from_csv(
    csv_path: str,
    image_root: str | None = None,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> List[DiseaseSample]:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    df = pd.read_csv(path)
    required = {"image_path", "label"}
    if not required.issubset(df.columns):
        raise ValueError(f"CSV must contain columns: {sorted(required)}")

    base_dir = Path(image_root) if image_root else path.parent

    rows = []
    for row in df.to_dict(orient="records"):
        split_value = _normalize_split(str(row.get("split", "")))
        if split_value and split_value not in VALID_SPLITS:
            raise ValueError(f"Invalid split '{split_value}', expected one of {sorted(VALID_SPLITS)}")

        img = Path(str(row["image_path"]))
        if not img.is_absolute():
            img = (base_dir / img).resolve()

        rows.append(
            {
                "image_path": str(img),
                "label": normalize_label(str(row["label"])),
                "split": split_value,
            }
        )

    all_has_split = all(bool(r["split"]) for r in rows)
    none_has_split = all(not bool(r["split"]) for r in rows)

    samples: List[DiseaseSample] = []
    if all_has_split:
        for row in rows:
            samples.append(
                DiseaseSample(
                    image_path=row["image_path"],
                    label=row["label"],
                    split=row["split"],
                )
            )
        return samples

    if not none_has_split:
        # TODO: 后续支持混合 split 的更细粒度策略。当前先把未标注 split 的样本视为 train。
        for row in rows:
            split = row["split"] or "train"
            samples.append(
                DiseaseSample(
                    image_path=row["image_path"],
                    label=row["label"],
                    split=split,
                )
            )
        return samples

    grouped: Dict[str, List[Path]] = {}
    for row in rows:
        grouped.setdefault(row["label"], []).append(Path(row["image_path"]))

    for label, images in grouped.items():
        split_result = _split_by_ratio(images, val_ratio=val_ratio, test_ratio=test_ratio, seed=seed)
        for split_name, split_images in split_result.items():
            for image_path in split_images:
                samples.append(
                    DiseaseSample(
                        image_path=str(image_path),
                        label=label,
                        split=split_name,
                    )
                )

    return samples


def load_samples_from_directory(
    data_dir: str,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> List[DiseaseSample]:
    root = Path(data_dir)
    if not root.exists():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    split_style = any((root / x).exists() for x in VALID_SPLITS)
    samples: List[DiseaseSample] = []

    if split_style:
        for split in ["train", "val", "test"]:
            split_dir = root / split
            if not split_dir.exists():
                continue
            for class_dir in sorted([x for x in split_dir.iterdir() if x.is_dir()], key=lambda p: p.name):
                label = normalize_label(class_dir.name)
                for image_path in _list_images(class_dir):
                    samples.append(
                        DiseaseSample(
                            image_path=str(image_path.resolve()),
                            label=label,
                            split=split,
                        )
                    )
        return samples

    class_dirs = [x for x in root.iterdir() if x.is_dir()]
    if not class_dirs:
        raise ValueError("Directory format requires class subfolders or split subfolders.")

    for class_dir in sorted(class_dirs, key=lambda p: p.name):
        label = normalize_label(class_dir.name)
        images = _list_images(class_dir)
        split_result = _split_by_ratio(images, val_ratio=val_ratio, test_ratio=test_ratio, seed=seed)
        for split_name, split_images in split_result.items():
            for image_path in split_images:
                samples.append(
                    DiseaseSample(
                        image_path=str(image_path.resolve()),
                        label=label,
                        split=split_name,
                    )
                )

    return samples


def load_disease_samples(
    source: str,
    source_type: str = "csv",
    image_root: str | None = None,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> List[DiseaseSample]:
    kind = source_type.strip().lower()
    if kind == "csv":
        return load_samples_from_csv(
            csv_path=source,
            image_root=image_root,
            val_ratio=val_ratio,
            test_ratio=test_ratio,
            seed=seed,
        )
    if kind in {"dir", "directory"}:
        return load_samples_from_directory(
            data_dir=source,
            val_ratio=val_ratio,
            test_ratio=test_ratio,
            seed=seed,
        )
    raise ValueError(f"Unsupported source_type: {source_type}")


def split_samples(samples: Iterable[DiseaseSample]) -> Dict[str, List[DiseaseSample]]:
    result: Dict[str, List[DiseaseSample]] = {"train": [], "val": [], "test": []}
    for sample in samples:
        result[sample.split].append(sample)
    return result


def ensure_label_mapping(samples: Sequence[DiseaseSample], mapping: LabelMapping | None = None) -> LabelMapping:
    if mapping is not None:
        return mapping
    labels = [sample.label for sample in samples]
    return build_label_mapping(labels)


def filter_missing_samples(samples: Sequence[DiseaseSample]) -> Tuple[List[DiseaseSample], int]:
    valid: List[DiseaseSample] = []
    missing_count = 0
    for sample in samples:
        if Path(sample.image_path).exists():
            valid.append(sample)
        else:
            missing_count += 1
    return valid, missing_count


def build_transforms(image_size: int = 224, augment: bool = True):
    if augment:
        train_transform = transforms.Compose(
            [
                transforms.RandomResizedCrop(image_size, scale=(0.7, 1.0)),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15, hue=0.03),
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ]
        )
    else:
        train_transform = transforms.Compose(
            [
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ]
        )

    eval_transform = transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )

    return train_transform, eval_transform


class DiseaseImageDataset(Dataset):
    def __init__(
        self,
        samples: Sequence[DiseaseSample],
        label_mapping: LabelMapping,
        transform=None,
    ) -> None:
        self.samples = list(samples)
        self.label_mapping = label_mapping
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        sample = self.samples[index]
        image = Image.open(sample.image_path).convert("RGB")
        if self.transform is not None:
            image = self.transform(image)

        target = self.label_mapping.encode(sample.label)
        return image, torch.tensor(target, dtype=torch.long), sample.image_path
