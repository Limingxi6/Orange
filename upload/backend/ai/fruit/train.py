"""
Fruit grading model training skeleton (MVP).

Use tabular/image-derived features and train a lightweight model
(for example: XGBoost, RandomForest, LightGBM).
"""

from pathlib import Path


def main() -> None:
    project_root = Path(__file__).resolve().parent
    data_dir = project_root / "data"
    output_dir = project_root / "artifacts"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("[fruit/train] data_dir =", data_dir)
    print("[fruit/train] output_dir =", output_dir)
    print("[fruit/train] TODO: implement feature engineering + training")


if __name__ == "__main__":
    main()

