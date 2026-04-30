"""
Fruit grading inference skeleton (MVP).
"""


def infer(features: dict) -> dict:
    return {
        "gradeCode": "B",
        "scores": {
            "colorScore": 80,
            "sizeScore": 78,
            "maturityScore": 82,
            "defectRatio": 0.08,
        },
        "debug": {"features": features},
    }


if __name__ == "__main__":
    print("TODO: integrate with your feature extraction + model artifact")

