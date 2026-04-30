"""
Disease model training skeleton (MVP).

Replace this placeholder with your actual data loader, augmentation,
model training, and artifact export.
"""

from pathlib import Path


def main() -> None:
    project_root = Path(__file__).resolve().parent
    data_dir = project_root / "data"
    output_dir = project_root / "artifacts"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("[disease/train] data_dir =", data_dir)
    print("[disease/train] output_dir =", output_dir)
    print("[disease/train] TODO: implement training pipeline")


if __name__ == "__main__":
    main()

