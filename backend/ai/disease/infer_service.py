"""
Disease inference service skeleton (MVP).

Expose an HTTP endpoint that accepts:
{
  "imageUrl": "...",
  "batchId": 1
}
and returns:
{
  "diseaseName": "...",
  "confidence": 0.91,
  "severity": "mid",
  "suggestion": "...",
  "modelVersion": "x.y.z",
  "boxes": []
}
"""


def infer(image_url: str, batch_id: int) -> dict:
    return {
        "diseaseName": "leaf-normal",
        "confidence": 0.5,
        "severity": "low",
        "suggestion": "placeholder suggestion",
        "modelVersion": "placeholder-v0",
        "boxes": [],
        "debug": {"image_url": image_url, "batch_id": batch_id},
    }


if __name__ == "__main__":
    print("TODO: wire this function into FastAPI/Flask service")

