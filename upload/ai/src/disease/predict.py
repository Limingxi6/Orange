from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Protocol

import torch
from PIL import Image

from .business import to_business_result
from .evaluate import load_checkpoint_bundle, resolve_device
from .labels import LabelMapping
from .model_factory import create_backbone


class DiseaseExplainer(Protocol):
    def explain(self, payload: Dict[str, Any]) -> Dict[str, Any]: ...


@dataclass
class PredictContext:
    batch_id: Optional[str] = None
    crop_type: Optional[str] = None
    growth_stage: Optional[str] = None
    weather: Optional[str] = None
    region: Optional[str] = None


class DiseasePredictor:
    def __init__(self, model_path: str, device: str = "auto") -> None:
        self.model_path = model_path
        self.device = resolve_device(device)

        bundle = load_checkpoint_bundle(model_path=model_path, device=self.device)
        self.bundle = bundle

        self.label_mapping = LabelMapping(
            label_to_id={str(k): int(v) for k, v in bundle["label_to_id"].items()},
            id_to_label={int(k): str(v) for k, v in bundle["id_to_label"].items()},
        )

        self.model = create_backbone(
            backbone=bundle["backbone"],
            num_classes=len(self.label_mapping.labels),
            pretrained=False,
        )
        self.model.load_state_dict(bundle["state_dict"])
        self.model.to(self.device)
        self.model.eval()

        image_size = int(bundle.get("image_size", 224))
        mean = bundle.get("normalize_mean", [0.485, 0.456, 0.406])
        std = bundle.get("normalize_std", [0.229, 0.224, 0.225])

        from torchvision import transforms

        self.transform = transforms.Compose(
            [
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=mean, std=std),
            ]
        )

    def predict_single(self, image_path: str, top_k: int = 3) -> Dict[str, Any]:
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        image = Image.open(path).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1)[0].cpu().tolist()

        score_items = []
        for idx, score in enumerate(probs):
            label = self.label_mapping.decode(idx)
            score_items.append((label, float(score)))
        score_items.sort(key=lambda x: x[1], reverse=True)

        pred_label, confidence = score_items[0]
        top_scores = {label: score for label, score in score_items[:top_k]}

        return {
            "label": pred_label,
            "confidence": float(confidence),
            "scores": top_scores,
            "backbone": self.bundle["backbone"],
        }


def predict_disease(
    image_path: str,
    model_path: str,
    batch_id: str | None = None,
    crop_type: str | None = None,
    growth_stage: str | None = None,
    weather: str | None = None,
    region: str | None = None,
    llm_explainer: DiseaseExplainer | None = None,
    device: str = "auto",
) -> Dict[str, Any]:
    predictor = DiseasePredictor(model_path=model_path, device=device)
    model_result = predictor.predict_single(image_path=image_path)

    business = to_business_result(
        label=model_result["label"],
        confidence=model_result["confidence"],
        crop_type=crop_type,
        growth_stage=growth_stage,
        weather=weather,
        region=region,
    )

    output: Dict[str, Any] = {
        "label": business.label,
        "confidence": round(float(business.confidence), 4),
        "severity": business.severity,
        "advice": business.advice,
        "needManualReview": business.needManualReview,
        "narrative": business.narrative,
        "scores": model_result["scores"],
        "batch_id": batch_id,
        "source": {
            "type": "pytorch_classifier",
            "model_path": str(Path(model_path).resolve()),
            "backbone": model_result["backbone"],
        },
    }

    if llm_explainer is not None:
        llm_payload = {
            "label": output["label"],
            "confidence": output["confidence"],
            "severity": output["severity"],
            "advice": output["advice"],
            "needManualReview": output["needManualReview"],
            "batch_id": batch_id or "",
            "crop_type": crop_type or "",
            "growth_stage": growth_stage or "",
            "weather": weather or "",
            "region": region or "",
        }

        llm_result = llm_explainer.explain(llm_payload)
        if llm_result.get("advice"):
            output["advice"] = str(llm_result["advice"])
        if isinstance(llm_result.get("needManualReview"), bool):
            output["needManualReview"] = bool(llm_result["needManualReview"]) or output["needManualReview"]
        if llm_result.get("narrative"):
            output["narrative"] = str(llm_result["narrative"])

        output["llm"] = {
            "enabled": True,
            "raw": llm_result.get("raw"),
        }
    else:
        output["llm"] = {"enabled": False}

    return output


if __name__ == "__main__":
    # TODO: 后续扩展为批量推理与异步推理服务。
    print(
        predict_disease(
            image_path="./data/sample_leaf.jpg",
            model_path="./models/disease_classifier.pt",
        )
    )
