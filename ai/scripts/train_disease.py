from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from disease.train import TrainConfig, train_disease_model, train_from_yaml


def main() -> None:
    parser = argparse.ArgumentParser(description="Train disease classifier (PyTorch)")
    parser.add_argument("--config", default="", help="YAML/JSON config path, optional")

    parser.add_argument("--source", default=str(PROJECT_ROOT / "data" / "disease_labels.sample.csv"))
    parser.add_argument("--source-type", default="csv", choices=["csv", "dir", "directory"])
    parser.add_argument("--image-root", default="", help="Optional image root for CSV relative paths")
    parser.add_argument("--labels", default="", help="Optional labels mapping file")

    parser.add_argument("--out", default=str(PROJECT_ROOT / "models" / "disease_classifier_leaves.pt"))
    parser.add_argument("--label-out", default=str(PROJECT_ROOT / "models" / "disease_label_mapping.json"))

    parser.add_argument("--backbone", default="mobilenet_v3_small")
    parser.add_argument("--pretrained", action="store_true")
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--disable-aug", action="store_true")

    args = parser.parse_args()

    if args.config:
        result = train_from_yaml(args.config)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    cfg = TrainConfig(
        source=args.source,
        source_type=args.source_type,
        image_root=args.image_root or None,
        labels_path=args.labels or None,
        output_checkpoint_path=args.out,
        output_label_map_path=args.label_out,
        backbone=args.backbone,
        pretrained=args.pretrained,
        image_size=args.image_size,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        weight_decay=args.weight_decay,
        num_workers=args.num_workers,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        random_seed=args.seed,
        device=args.device,
        use_augmentation=not args.disable_aug,
    )

    result = train_disease_model(cfg)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
