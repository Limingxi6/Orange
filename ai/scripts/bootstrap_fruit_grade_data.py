from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
import requests
import yaml
from PIL import Image, ImageStat

FEATURE_COLUMNS = [
    "image_id",
    "color_score",
    "defect_ratio",
    "diameter_mm",
    "brix",
    "weight_g",
    "region",
    "channel",
    "package_type",
]

LABEL_COLUMNS = [
    "image_id",
    "grade_code",
    "target_retail_price",
    "target_wholesale_price",
]

PRICE_BY_GRADE = {
    "A": (7.2, 4.9),
    "B": (5.8, 3.9),
    "C": (4.3, 2.9),
}

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
DEFECT_KEYWORDS = ("defect", "rot", "rotten", "disease", "scab", "canker", "spot", "blemish")


@dataclass
class BuildResult:
    source: str
    features: int
    labels: int
    detail: str


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def normalize_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(name).lower())


def slugify(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_").lower()


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES


def ensure_contract_dirs(dataset_root: Path) -> Path:
    dataset_root.mkdir(parents=True, exist_ok=True)
    images_dir = dataset_root / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    return images_dir


def load_contract_csv(path: Path, columns: list[str]) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=columns)
    df = pd.read_csv(path, encoding="utf-8-sig")
    for col in columns:
        if col not in df.columns:
            df[col] = None
    return df[columns]


def write_contract_rows(
    dataset_root: Path,
    feature_rows: list[dict[str, Any]],
    label_rows: list[dict[str, Any]],
    overwrite: bool,
) -> None:
    features_path = dataset_root / "features.csv"
    labels_path = dataset_root / "labels.csv"

    new_features = pd.DataFrame(feature_rows, columns=FEATURE_COLUMNS)
    new_labels = pd.DataFrame(label_rows, columns=LABEL_COLUMNS)

    if overwrite:
        merged_features = new_features
        merged_labels = new_labels
    else:
        old_features = load_contract_csv(features_path, FEATURE_COLUMNS)
        old_labels = load_contract_csv(labels_path, LABEL_COLUMNS)
        if old_features.empty:
            merged_features = new_features
        elif new_features.empty:
            merged_features = old_features
        else:
            merged_features = pd.concat([old_features, new_features], ignore_index=True)

        if old_labels.empty:
            merged_labels = new_labels
        elif new_labels.empty:
            merged_labels = old_labels
        else:
            merged_labels = pd.concat([old_labels, new_labels], ignore_index=True)

    if not merged_features.empty:
        merged_features = merged_features.drop_duplicates(subset=["image_id"], keep="last")
        merged_features = merged_features[FEATURE_COLUMNS]
    if not merged_labels.empty:
        merged_labels = merged_labels.drop_duplicates(subset=["image_id"], keep="last")
        merged_labels = merged_labels[LABEL_COLUMNS]

    merged_features.to_csv(features_path, index=False, encoding="utf-8-sig")
    merged_labels.to_csv(labels_path, index=False, encoding="utf-8-sig")


def save_manifest(dataset_root: Path, result: BuildResult, overwrite: bool) -> None:
    manifest_path = dataset_root / "import_manifest.json"
    history: list[dict[str, Any]] = []
    if manifest_path.exists() and not overwrite:
        try:
            history = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            history = []

    history.append(
        {
            "source": result.source,
            "features": result.features,
            "labels": result.labels,
            "detail": result.detail,
        }
    )
    manifest_path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


def infer_grade(defect_ratio: float, brix: float | None = None, color_score: float | None = None) -> str:
    if defect_ratio <= 0.05 and (brix is None or brix >= 11.5) and (color_score is None or color_score >= 78):
        return "A"
    if defect_ratio <= 0.12 and (brix is None or brix >= 9.5) and (color_score is None or color_score >= 65):
        return "B"
    return "C"


def grade_from_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().upper()
    if text in {"A", "B", "C"}:
        return text
    if "A" in text or any(k in text for k in ["PREMIUM", "FRESH", "GOOD", "HIGH"]):
        return "A"
    if "B" in text or any(k in text for k in ["MID", "MEDIUM", "NORMAL"]):
        return "B"
    if "C" in text or any(k in text for k in ["LOW", "BAD", "ROTTEN", "DEFECT"]):
        return "C"
    numeric = to_float(value)
    if numeric is None:
        return None
    if numeric >= 4:
        return "A"
    if numeric >= 2.5:
        return "B"
    return "C"


def price_by_grade(grade: str) -> tuple[float, float]:
    return PRICE_BY_GRADE.get(grade, PRICE_BY_GRADE["B"])


def image_color_score(image_path: Path) -> float:
    image = Image.open(image_path).convert("HSV")
    stat = ImageStat.Stat(image)
    sat = float(stat.mean[1])
    val = float(stat.mean[2])
    score = 40 + sat * 0.25 + val * 0.15
    return round(clamp(score, 45, 96), 2)


def choose_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    normalized = {normalize_key(col): col for col in df.columns}
    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]
    return None


def find_first_csv(root: Path) -> Path | None:
    for path in root.rglob("*.csv"):
        if path.is_file():
            return path
    return None


def download_file(url: str, output_path: Path, timeout_sec: int = 120) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=timeout_sec) as resp:
        resp.raise_for_status()
        with output_path.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)


def extract_if_archive(file_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    suffixes = "".join(file_path.suffixes).lower()

    if suffixes.endswith(".zip"):
        with zipfile.ZipFile(file_path, "r") as zf:
            zf.extractall(output_dir)
        return output_dir

    if suffixes.endswith(".tar.gz") or suffixes.endswith(".tgz") or suffixes.endswith(".tar"):
        with tarfile.open(file_path, "r:*") as tf:
            tf.extractall(output_dir)
        return output_dir

    return file_path.parent


def run_kaggle_download(dataset_slug: str, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "kaggle",
        "datasets",
        "download",
        "-d",
        dataset_slug,
        "-p",
        str(output_dir),
        "--unzip",
    ]
    subprocess.run(cmd, check=True)
    return output_dir


def download_zenodo_record(record_id: str, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    api_url = f"https://zenodo.org/api/records/{record_id}"
    resp = requests.get(api_url, timeout=60)
    resp.raise_for_status()
    payload = resp.json()

    files = payload.get("files", [])
    if not files:
        raise RuntimeError(f"No files found in Zenodo record {record_id}")

    for file_item in files:
        key = file_item.get("key")
        link = (file_item.get("links") or {}).get("self")
        if not key or not link:
            continue
        target = output_dir / key
        download_file(link, target)
        extract_if_archive(target, output_dir / "extracted")

    extracted = output_dir / "extracted"
    return extracted if extracted.exists() else output_dir


def convert_tabular_csv(
    csv_path: Path,
    source_name: str,
    dataset_root: Path,
    channel: str,
    region: str,
    package_type: str,
    overwrite: bool,
) -> BuildResult:
    df = pd.read_csv(csv_path, encoding="utf-8-sig")

    col_color = choose_col(df, ["colorscore", "color", "colour", "ripenessscore"])
    col_defect = choose_col(df, ["defectratio", "defect", "defectrate", "defectpercentage"])
    col_diameter = choose_col(df, ["diametermm", "diameter", "size", "sizecm"])
    col_brix = choose_col(df, ["brix", "sweetness", "sugar", "totalsolublesolids"])
    col_weight = choose_col(df, ["weightg", "weight", "mass"])
    col_region = choose_col(df, ["region", "origin", "location", "area"])
    col_channel = choose_col(df, ["channel", "saleschannel", "marketchannel"])
    col_package = choose_col(df, ["packagetype", "packaging", "package", "packtype"])
    col_grade = choose_col(df, ["gradecode", "grade", "quality", "qualitylabel", "class", "label"])
    col_retail = choose_col(df, ["targetretailprice", "retailprice", "soldprice", "price", "retail"])
    col_wholesale = choose_col(df, ["targetwholesaleprice", "wholesaleprice", "wholesale"])

    feature_rows: list[dict[str, Any]] = []
    label_rows: list[dict[str, Any]] = []

    for idx, row in df.iterrows():
        image_id = f"{slugify(source_name)}_{idx + 1:06d}"

        color_score = to_float(row[col_color]) if col_color else None
        if color_score is None:
            color_score = 72.0

        defect_ratio = to_float(row[col_defect]) if col_defect else None
        if defect_ratio is None:
            defect_ratio = 0.08
        if defect_ratio > 1:
            defect_ratio = defect_ratio / 100
        defect_ratio = round(clamp(defect_ratio, 0, 1), 4)

        diameter = to_float(row[col_diameter]) if col_diameter else None
        if diameter is not None and diameter < 20:
            diameter = diameter * 10

        brix = to_float(row[col_brix]) if col_brix else None
        weight = to_float(row[col_weight]) if col_weight else None

        grade = grade_from_text(row[col_grade]) if col_grade else None
        if grade is None:
            grade = infer_grade(defect_ratio, brix, color_score)

        retail = to_float(row[col_retail]) if col_retail else None
        wholesale = to_float(row[col_wholesale]) if col_wholesale else None
        if retail is None or wholesale is None:
            d_retail, d_wholesale = price_by_grade(grade)
            retail = retail if retail is not None else d_retail
            wholesale = wholesale if wholesale is not None else d_wholesale

        feature_rows.append(
            {
                "image_id": image_id,
                "color_score": round(clamp(color_score, 0, 100), 2),
                "defect_ratio": defect_ratio,
                "diameter_mm": round(diameter, 2) if diameter is not None else None,
                "brix": round(brix, 2) if brix is not None else None,
                "weight_g": round(weight, 2) if weight is not None else None,
                "region": str(row[col_region]).strip() if col_region and pd.notna(row[col_region]) else region,
                "channel": str(row[col_channel]).strip() if col_channel and pd.notna(row[col_channel]) else channel,
                "package_type": str(row[col_package]).strip()
                if col_package and pd.notna(row[col_package])
                else package_type,
            }
        )
        label_rows.append(
            {
                "image_id": image_id,
                "grade_code": grade,
                "target_retail_price": round(float(retail), 2),
                "target_wholesale_price": round(float(wholesale), 2),
            }
        )

    write_contract_rows(dataset_root, feature_rows, label_rows, overwrite)
    return BuildResult(
        source=source_name,
        features=len(feature_rows),
        labels=len(label_rows),
        detail=f"converted tabular csv: {csv_path}",
    )


def convert_image_classification(
    source_dir: Path,
    source_name: str,
    dataset_root: Path,
    channel: str,
    region: str,
    package_type: str,
    overwrite: bool,
    max_images: int,
) -> BuildResult:
    images_dir = ensure_contract_dirs(dataset_root)

    feature_rows: list[dict[str, Any]] = []
    label_rows: list[dict[str, Any]] = []

    count = 0
    for image_path in source_dir.rglob("*"):
        if not is_image_file(image_path):
            continue
        class_name = image_path.parent.name.lower()
        image_id = f"{slugify(source_name)}_{slugify(image_path.stem)}_{count + 1:06d}"

        out_ext = image_path.suffix.lower() if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
        shutil.copy2(image_path, images_dir / f"{image_id}{out_ext}")

        color_score = image_color_score(image_path)
        defect_ratio = 0.03 if any(k in class_name for k in ["fresh", "healthy", "good"]) else 0.16
        if any(k in class_name for k in ["mid", "medium", "normal"]):
            defect_ratio = 0.08
        if any(k in class_name for k in DEFECT_KEYWORDS):
            defect_ratio = max(defect_ratio, 0.12)

        grade = grade_from_text(class_name) or infer_grade(defect_ratio, None, color_score)
        retail, wholesale = price_by_grade(grade)

        feature_rows.append(
            {
                "image_id": image_id,
                "color_score": color_score,
                "defect_ratio": round(defect_ratio, 4),
                "diameter_mm": None,
                "brix": None,
                "weight_g": None,
                "region": region,
                "channel": channel,
                "package_type": package_type,
            }
        )
        label_rows.append(
            {
                "image_id": image_id,
                "grade_code": grade,
                "target_retail_price": retail,
                "target_wholesale_price": wholesale,
            }
        )

        count += 1
        if max_images > 0 and count >= max_images:
            break

    write_contract_rows(dataset_root, feature_rows, label_rows, overwrite)
    return BuildResult(
        source=source_name,
        features=len(feature_rows),
        labels=len(label_rows),
        detail=f"converted image classification dir: {source_dir}",
    )


def discover_class_names(dataset_yaml: Path) -> dict[int, str]:
    if not dataset_yaml.exists():
        return {}
    data = yaml.safe_load(dataset_yaml.read_text(encoding="utf-8")) or {}
    names = data.get("names")
    if isinstance(names, dict):
        return {int(k): str(v) for k, v in names.items()}
    if isinstance(names, list):
        return {idx: str(name) for idx, name in enumerate(names)}
    return {}


def find_label_file(image_path: Path) -> Path | None:
    candidate_same = image_path.with_suffix(".txt")
    if candidate_same.exists():
        return candidate_same

    parts = list(image_path.parts)
    if "images" in parts:
        idx = parts.index("images")
        label_parts = parts[:]
        label_parts[idx] = "labels"
        candidate_labels = Path(*label_parts).with_suffix(".txt")
        if candidate_labels.exists():
            return candidate_labels

    labels_dir = image_path.parent.parent / "labels"
    fallback = labels_dir / f"{image_path.stem}.txt"
    if fallback.exists():
        return fallback
    return None


def parse_yolo_defect_ratio(label_path: Path, defect_ids: set[int]) -> float:
    if not label_path or not label_path.exists():
        return 0.08
    ratio = 0.0
    for line in label_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        parts = line.strip().split()
        if len(parts) < 5:
            continue
        cls_id = int(float(parts[0]))
        w = float(parts[3])
        h = float(parts[4])
        if cls_id in defect_ids:
            ratio += max(0.0, w * h)
    if ratio <= 0:
        return 0.05
    return round(clamp(ratio, 0, 0.4), 4)


def convert_yolo(
    source_dir: Path,
    source_name: str,
    dataset_root: Path,
    channel: str,
    region: str,
    package_type: str,
    overwrite: bool,
    max_images: int,
) -> BuildResult:
    images_out = ensure_contract_dirs(dataset_root)

    names = discover_class_names(source_dir / "data.yaml")
    defect_ids = {
        idx
        for idx, name in names.items()
        if any(keyword in name.lower() for keyword in DEFECT_KEYWORDS)
    }

    feature_rows: list[dict[str, Any]] = []
    label_rows: list[dict[str, Any]] = []

    count = 0
    for image_path in source_dir.rglob("*"):
        if not is_image_file(image_path):
            continue

        image_id = f"{slugify(source_name)}_{slugify(image_path.stem)}_{count + 1:06d}"
        out_ext = image_path.suffix.lower() if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
        shutil.copy2(image_path, images_out / f"{image_id}{out_ext}")

        color_score = image_color_score(image_path)
        label_file = find_label_file(image_path)
        defect_ratio = parse_yolo_defect_ratio(label_file, defect_ids)
        grade = infer_grade(defect_ratio, None, color_score)
        retail, wholesale = price_by_grade(grade)

        feature_rows.append(
            {
                "image_id": image_id,
                "color_score": color_score,
                "defect_ratio": defect_ratio,
                "diameter_mm": None,
                "brix": None,
                "weight_g": None,
                "region": region,
                "channel": channel,
                "package_type": package_type,
            }
        )
        label_rows.append(
            {
                "image_id": image_id,
                "grade_code": grade,
                "target_retail_price": retail,
                "target_wholesale_price": wholesale,
            }
        )

        count += 1
        if max_images > 0 and count >= max_images:
            break

    write_contract_rows(dataset_root, feature_rows, label_rows, overwrite)
    return BuildResult(
        source=source_name,
        features=len(feature_rows),
        labels=len(label_rows),
        detail=f"converted yolo dir: {source_dir}",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Download and convert external data to fruit-grade contract")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_bootstrap_kaggle = subparsers.add_parser("bootstrap-kaggle", help="Download Kaggle dataset and convert csv")
    p_bootstrap_kaggle.add_argument("--dataset-root", default="ai/datasets/fruit_grade/v1")
    p_bootstrap_kaggle.add_argument("--raw-dir", default="ai/datasets/fruit_grade/raw/kaggle")
    p_bootstrap_kaggle.add_argument("--kaggle-slug", default="shruthiiiee/orange-quality")
    p_bootstrap_kaggle.add_argument("--csv-path", default="")
    p_bootstrap_kaggle.add_argument("--channel", default="ecommerce")
    p_bootstrap_kaggle.add_argument("--region", default="湖北宜昌")
    p_bootstrap_kaggle.add_argument("--package-type", default="simple")
    p_bootstrap_kaggle.add_argument("--overwrite", action="store_true")

    p_bootstrap_zenodo = subparsers.add_parser("bootstrap-zenodo-yolo", help="Download Zenodo record and convert YOLO-style data")
    p_bootstrap_zenodo.add_argument("--dataset-root", default="ai/datasets/fruit_grade/v1")
    p_bootstrap_zenodo.add_argument("--raw-dir", default="ai/datasets/fruit_grade/raw/zenodo")
    p_bootstrap_zenodo.add_argument("--record-id", default="17866344")
    p_bootstrap_zenodo.add_argument("--source-dir", default="")
    p_bootstrap_zenodo.add_argument("--source-name", default="campaneta_zenodo")
    p_bootstrap_zenodo.add_argument("--channel", default="ecommerce")
    p_bootstrap_zenodo.add_argument("--region", default="湖北宜昌")
    p_bootstrap_zenodo.add_argument("--package-type", default="simple")
    p_bootstrap_zenodo.add_argument("--max-images", type=int, default=0)
    p_bootstrap_zenodo.add_argument("--overwrite", action="store_true")

    p_convert_cls = subparsers.add_parser("convert-image-classification", help="Convert local image classification folder")
    p_convert_cls.add_argument("--dataset-root", default="ai/datasets/fruit_grade/v1")
    p_convert_cls.add_argument("--source-dir", required=True)
    p_convert_cls.add_argument("--source-name", default="image_classification")
    p_convert_cls.add_argument("--channel", default="ecommerce")
    p_convert_cls.add_argument("--region", default="湖北宜昌")
    p_convert_cls.add_argument("--package-type", default="simple")
    p_convert_cls.add_argument("--max-images", type=int, default=0)
    p_convert_cls.add_argument("--overwrite", action="store_true")

    p_convert_yolo = subparsers.add_parser("convert-yolo", help="Convert local YOLO dataset")
    p_convert_yolo.add_argument("--dataset-root", default="ai/datasets/fruit_grade/v1")
    p_convert_yolo.add_argument("--source-dir", required=True)
    p_convert_yolo.add_argument("--source-name", default="yolo_dataset")
    p_convert_yolo.add_argument("--channel", default="ecommerce")
    p_convert_yolo.add_argument("--region", default="湖北宜昌")
    p_convert_yolo.add_argument("--package-type", default="simple")
    p_convert_yolo.add_argument("--max-images", type=int, default=0)
    p_convert_yolo.add_argument("--overwrite", action="store_true")

    p_convert_csv = subparsers.add_parser("convert-tabular", help="Convert local tabular csv")
    p_convert_csv.add_argument("--dataset-root", default="ai/datasets/fruit_grade/v1")
    p_convert_csv.add_argument("--csv-path", required=True)
    p_convert_csv.add_argument("--source-name", default="tabular_csv")
    p_convert_csv.add_argument("--channel", default="ecommerce")
    p_convert_csv.add_argument("--region", default="湖北宜昌")
    p_convert_csv.add_argument("--package-type", default="simple")
    p_convert_csv.add_argument("--overwrite", action="store_true")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    dataset_root = Path(args.dataset_root)
    ensure_contract_dirs(dataset_root)

    if args.command == "bootstrap-kaggle":
        raw_dir = run_kaggle_download(args.kaggle_slug, Path(args.raw_dir))
        csv_path = Path(args.csv_path) if args.csv_path else find_first_csv(raw_dir)
        if not csv_path:
            raise RuntimeError("No csv file found after Kaggle download; use --csv-path explicitly")
        result = convert_tabular_csv(
            csv_path=csv_path,
            source_name="kaggle_orange_quality",
            dataset_root=dataset_root,
            channel=args.channel,
            region=args.region,
            package_type=args.package_type,
            overwrite=args.overwrite,
        )

    elif args.command == "bootstrap-zenodo-yolo":
        if args.source_dir:
            source_dir = Path(args.source_dir)
        else:
            source_dir = download_zenodo_record(args.record_id, Path(args.raw_dir))

        result = convert_yolo(
            source_dir=source_dir,
            source_name=args.source_name,
            dataset_root=dataset_root,
            channel=args.channel,
            region=args.region,
            package_type=args.package_type,
            overwrite=args.overwrite,
            max_images=args.max_images,
        )

    elif args.command == "convert-image-classification":
        result = convert_image_classification(
            source_dir=Path(args.source_dir),
            source_name=args.source_name,
            dataset_root=dataset_root,
            channel=args.channel,
            region=args.region,
            package_type=args.package_type,
            overwrite=args.overwrite,
            max_images=args.max_images,
        )

    elif args.command == "convert-yolo":
        result = convert_yolo(
            source_dir=Path(args.source_dir),
            source_name=args.source_name,
            dataset_root=dataset_root,
            channel=args.channel,
            region=args.region,
            package_type=args.package_type,
            overwrite=args.overwrite,
            max_images=args.max_images,
        )

    elif args.command == "convert-tabular":
        result = convert_tabular_csv(
            csv_path=Path(args.csv_path),
            source_name=args.source_name,
            dataset_root=dataset_root,
            channel=args.channel,
            region=args.region,
            package_type=args.package_type,
            overwrite=args.overwrite,
        )

    else:
        raise RuntimeError(f"Unsupported command: {args.command}")

    save_manifest(dataset_root, result, overwrite=getattr(args, "overwrite", False))
    print(
        json.dumps(
            {
                "source": result.source,
                "features": result.features,
                "labels": result.labels,
                "detail": result.detail,
                "datasetRoot": str(dataset_root),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
