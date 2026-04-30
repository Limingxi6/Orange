from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from fruit_grade.train import TrainConfig, train_grade_model


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train fruit tabular grade model")
    parser.add_argument(
        "--dataset-root",
        default="datasets/fruit_grade/v1",
        help="Dataset root directory containing features.csv and labels.csv",
    )
    parser.add_argument(
        "--output-model",
        default="models/fruit_grade/grade_model.joblib",
        help="Output model file path",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Validation split ratio (0~1)",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print JSON summary",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    summary = train_grade_model(
        TrainConfig(
            dataset_root=Path(args.dataset_root),
            output_model=Path(args.output_model),
            test_size=args.test_size,
            random_state=args.random_state,
        )
    )

    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(summary)


if __name__ == "__main__":
    main()
