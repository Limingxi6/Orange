from __future__ import annotations

from typing import Dict, List

import torch.nn as nn
from torchvision import models


SUPPORTED_BACKBONES: List[str] = [
    "resnet18",
    "mobilenet_v3_small",
    "efficientnet_b0",
]


def create_backbone(backbone: str, num_classes: int, pretrained: bool = False) -> nn.Module:
    name = backbone.strip().lower()

    if name == "resnet18":
        weights = models.ResNet18_Weights.DEFAULT if pretrained else None
        model = models.resnet18(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model

    if name == "mobilenet_v3_small":
        weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v3_small(weights=weights)
        model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, num_classes)
        return model

    if name == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        model = models.efficientnet_b0(weights=weights)
        model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, num_classes)
        return model

    raise ValueError(f"Unsupported backbone '{backbone}'. Available: {SUPPORTED_BACKBONES}")


def model_factory() -> Dict[str, str]:
    return {
        "default": "mobilenet_v3_small",
        "supported": ", ".join(SUPPORTED_BACKBONES),
    }


# TODO: 后续补充 timm backbone 与蒸馏模型支持。
