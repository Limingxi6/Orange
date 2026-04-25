from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


REQUIRED_FEATURE_COLUMNS = {
    "image_id",
    "color_score",
    "defect_ratio",
    "diameter_mm",
    "brix",
    "weight_g",
    "region",
    "channel",
    "package_type",
}

REQUIRED_LABEL_COLUMNS = {
    "image_id",
    "grade_code",
    "target_retail_price",
    "target_wholesale_price",
}


@dataclass
class CheckIssue:
    level: str  # error | warning
    code: str
    message: str


class DatasetChecker:
    def __init__(
        self,
        dataset_root: Path,
        min_samples: int,
        max_majority_ratio: float,
        require_images: bool,
        max_missing_image_rate: float,
    ) -> None:
        self.dataset_root = dataset_root
        self.min_samples = min_samples
        self.max_majority_ratio = max_majority_ratio
        self.require_images = require_images
        self.max_missing_image_rate = max_missing_image_rate
        self.issues: list[CheckIssue] = []

    def run(self) -> dict[str, Any]:
        features_path = self.dataset_root / "features.csv"
        labels_path = self.dataset_root / "labels.csv"
        images_dir = self.dataset_root / "images"

        if not self.dataset_root.exists():
            self.error("DATASET_ROOT_MISSING", f"dataset root not found: {self.dataset_root}")
            return self.report()

        if not features_path.exists():
            self.error("FEATURES_MISSING", f"features.csv not found: {features_path}")
            return self.report()

        if not labels_path.exists():
            self.error("LABELS_MISSING", f"labels.csv not found: {labels_path}")
            return self.report()

        features = self.read_csv(features_path, "features.csv")
        labels = self.read_csv(labels_path, "labels.csv")
        if features is None or labels is None:
            return self.report()

        self.check_columns(features, REQUIRED_FEATURE_COLUMNS, "features.csv")
        self.check_columns(labels, REQUIRED_LABEL_COLUMNS, "labels.csv")
        if self.has_errors():
            return self.report()

        self.check_non_empty(features, labels)
        self.check_duplicates(features, "features.csv")
        self.check_duplicates(labels, "labels.csv")
        self.check_key_alignment(features, labels)
        self.check_numeric_ranges(features, labels)
        self.check_grade_values(labels)
        self.check_missing_values(features, labels)
        self.check_distribution(features, labels)

        if self.require_images:
            self.check_images(images_dir, features["image_id"].astype(str).tolist())

        return self.report()

    def read_csv(self, path: Path, name: str) -> pd.DataFrame | None:
        try:
            return pd.read_csv(path, encoding="utf-8-sig")
        except Exception as exc:
            self.error("CSV_READ_FAILED", f"failed to read {name}: {exc}")
            return None

    def check_columns(self, df: pd.DataFrame, required: set[str], name: str) -> None:
        missing = sorted(required - set(df.columns))
        if missing:
            self.error("COLUMNS_MISSING", f"{name} missing columns: {missing}")

    def check_non_empty(self, features: pd.DataFrame, labels: pd.DataFrame) -> None:
        if len(features) == 0:
            self.error("FEATURES_EMPTY", "features.csv has no rows")
        if len(labels) == 0:
            self.error("LABELS_EMPTY", "labels.csv has no rows")
        if len(features) < self.min_samples:
            self.warning(
                "SAMPLE_SIZE_LOW",
                f"features rows={len(features)} below recommended minimum={self.min_samples}",
            )

    def check_duplicates(self, df: pd.DataFrame, name: str) -> None:
        dup_count = int(df["image_id"].astype(str).duplicated().sum())
        if dup_count > 0:
            self.error("DUPLICATE_IMAGE_ID", f"{name} has duplicated image_id count={dup_count}")

    def check_key_alignment(self, features: pd.DataFrame, labels: pd.DataFrame) -> None:
        feature_ids = set(features["image_id"].astype(str))
        label_ids = set(labels["image_id"].astype(str))

        only_features = feature_ids - label_ids
        only_labels = label_ids - feature_ids

        if only_features:
            self.error("UNMATCHED_FEATURE_IDS", f"image_id in features only: {len(only_features)}")
        if only_labels:
            self.error("UNMATCHED_LABEL_IDS", f"image_id in labels only: {len(only_labels)}")

    def check_numeric_ranges(self, features: pd.DataFrame, labels: pd.DataFrame) -> None:
        self.check_range(features, "color_score", 0, 100)
        self.check_range(features, "defect_ratio", 0, 1)
        self.check_range(features, "diameter_mm", 30, 120, allow_null=True)
        self.check_range(features, "brix", 1, 25, allow_null=True)
        self.check_range(features, "weight_g", 30, 1000, allow_null=True)

        self.check_range(labels, "target_retail_price", 0.01, 9999)
        self.check_range(labels, "target_wholesale_price", 0.01, 9999)

    def check_range(
        self,
        df: pd.DataFrame,
        col: str,
        low: float,
        high: float,
        allow_null: bool = False,
    ) -> None:
        numeric = pd.to_numeric(df[col], errors="coerce")
        if not allow_null:
            null_count = int(numeric.isna().sum())
            if null_count > 0:
                self.error("NUMERIC_NULL", f"{col} has null/non-numeric count={null_count}")

        out_of_range = numeric.dropna().loc[(numeric.dropna() < low) | (numeric.dropna() > high)]
        if not out_of_range.empty:
            self.error(
                "OUT_OF_RANGE",
                f"{col} has {len(out_of_range)} values out of range [{low}, {high}]",
            )

    def check_grade_values(self, labels: pd.DataFrame) -> None:
        values = set(labels["grade_code"].astype(str).str.upper())
        invalid = sorted(v for v in values if v not in {"A", "B", "C"})
        if invalid:
            self.error("INVALID_GRADE_CODE", f"grade_code contains invalid values: {invalid}")

    def check_missing_values(self, features: pd.DataFrame, labels: pd.DataFrame) -> None:
        required_non_null_features = ["image_id", "color_score", "defect_ratio"]
        for col in required_non_null_features:
            miss = int(features[col].isna().sum())
            if miss > 0:
                self.error("MISSING_REQUIRED_FEATURE", f"features.{col} missing count={miss}")

        required_non_null_labels = ["image_id", "grade_code", "target_retail_price", "target_wholesale_price"]
        for col in required_non_null_labels:
            miss = int(labels[col].isna().sum())
            if miss > 0:
                self.error("MISSING_REQUIRED_LABEL", f"labels.{col} missing count={miss}")

        optional_context = ["region", "channel", "package_type"]
        for col in optional_context:
            miss = int(features[col].isna().sum())
            if miss > 0:
                self.warning("MISSING_CONTEXT", f"features.{col} missing count={miss}")

    def check_distribution(self, features: pd.DataFrame, labels: pd.DataFrame) -> None:
        for col in ["region", "channel", "package_type"]:
            self.check_majority_ratio(features[col], f"features.{col}")
        self.check_majority_ratio(labels["grade_code"].astype(str).str.upper(), "labels.grade_code")

    def check_majority_ratio(self, series: pd.Series, name: str) -> None:
        valid = series.dropna().astype(str)
        if valid.empty:
            self.warning("DISTRIBUTION_EMPTY", f"{name} has no valid value")
            return

        top_ratio = float(valid.value_counts(normalize=True).iloc[0])
        if top_ratio > self.max_majority_ratio:
            self.warning(
                "DATA_IMBALANCE",
                f"{name} majority ratio={top_ratio:.3f} exceeds threshold={self.max_majority_ratio:.3f}",
            )

    def check_images(self, images_dir: Path, image_ids: list[str]) -> None:
        if not images_dir.exists():
            self.error("IMAGES_DIR_MISSING", f"images directory not found: {images_dir}")
            return

        suffixes = [".jpg", ".jpeg", ".png", ".webp"]
        missing = 0

        for image_id in image_ids:
            found = any((images_dir / f"{image_id}{ext}").exists() for ext in suffixes)
            if not found:
                missing += 1

        if not image_ids:
            return

        miss_rate = missing / len(image_ids)
        if miss_rate > self.max_missing_image_rate:
            self.error(
                "IMAGES_MISSING_TOO_MANY",
                f"missing image files={missing}/{len(image_ids)} rate={miss_rate:.3f}, threshold={self.max_missing_image_rate:.3f}",
            )
        elif missing > 0:
            self.warning(
                "IMAGES_MISSING",
                f"missing image files={missing}/{len(image_ids)} rate={miss_rate:.3f}",
            )

    def has_errors(self) -> bool:
        return any(i.level == "error" for i in self.issues)

    def error(self, code: str, message: str) -> None:
        self.issues.append(CheckIssue(level="error", code=code, message=message))

    def warning(self, code: str, message: str) -> None:
        self.issues.append(CheckIssue(level="warning", code=code, message=message))

    def report(self) -> dict[str, Any]:
        errors = [i for i in self.issues if i.level == "error"]
        warnings = [i for i in self.issues if i.level == "warning"]

        return {
            "datasetRoot": str(self.dataset_root),
            "errors": [i.__dict__ for i in errors],
            "warnings": [i.__dict__ for i in warnings],
            "errorCount": len(errors),
            "warningCount": len(warnings),
        }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Check fruit grade dataset quality")
    parser.add_argument(
        "--dataset-root",
        default="ai/datasets/fruit_grade/v1",
        help="Dataset root path containing images/features.csv/labels.csv",
    )
    parser.add_argument("--min-samples", type=int, default=200, help="Recommended minimum samples")
    parser.add_argument(
        "--max-majority-ratio",
        type=float,
        default=0.8,
        help="Warn when dominant class ratio exceeds this value",
    )
    parser.add_argument(
        "--max-missing-image-rate",
        type=float,
        default=0.02,
        help="Fail when missing image rate exceeds this threshold",
    )
    parser.add_argument(
        "--require-images",
        action="store_true",
        default=False,
        help="Enable image existence checks",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return non-zero when warning exists",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable JSON output",
    )
    return parser


def print_text_report(report: dict[str, Any]) -> None:
    print(f"dataset: {report['datasetRoot']}")
    print(f"errors: {report['errorCount']} | warnings: {report['warningCount']}")

    if report["errors"]:
        print("\n[ERRORS]")
        for item in report["errors"]:
            print(f"- {item['code']}: {item['message']}")

    if report["warnings"]:
        print("\n[WARNINGS]")
        for item in report["warnings"]:
            print(f"- {item['code']}: {item['message']}")

    if report["errorCount"] == 0 and report["warningCount"] == 0:
        print("\nPASS: dataset quality checks passed")


def main() -> None:
    args = build_parser().parse_args()

    checker = DatasetChecker(
        dataset_root=Path(args.dataset_root),
        min_samples=args.min_samples,
        max_majority_ratio=args.max_majority_ratio,
        require_images=args.require_images,
        max_missing_image_rate=args.max_missing_image_rate,
    )
    report = checker.run()

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_text_report(report)

    if report["errorCount"] > 0:
        sys.exit(2)
    if args.strict and report["warningCount"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
