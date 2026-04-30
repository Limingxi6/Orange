from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from disease.evaluate import evaluate_disease_model


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate disease classifier checkpoint")
    parser.add_argument("--model", default=str(PROJECT_ROOT / "models" / "disease_classifier_leaves.pt"))
    parser.add_argument("--source", default=str(PROJECT_ROOT / "data" / "disease_labels.sample.csv"))
    parser.add_argument("--source-type", default="csv", choices=["csv", "dir", "directory"])
    parser.add_argument("--image-root", default="")
    parser.add_argument("--split", default="test", choices=["train", "val", "test"])
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    result = evaluate_disease_model(
        model_path=args.model,
        source=args.source,
        source_type=args.source_type,
        image_root=args.image_root or None,
        split=args.split,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        device=args.device,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        random_seed=args.seed,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
