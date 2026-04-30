from __future__ import annotations

from dataclasses import dataclass
from hashlib import md5
from pathlib import Path
from typing import Dict

import numpy as np
from PIL import Image

from .schema import FruitGradeInput


@dataclass
class VisualQualityFeatures:
    mean_r: float
    mean_g: float
    mean_b: float
    saturation_mean: float
    brightness_mean: float
    dark_pixel_ratio: float
    low_sat_ratio: float
    texture_std: float
    feature_source: str

    def to_dict(self) -> Dict[str, float | str]:
        return {
            "mean_r": self.mean_r,
            "mean_g": self.mean_g,
            "mean_b": self.mean_b,
            "saturation_mean": self.saturation_mean,
            "brightness_mean": self.brightness_mean,
            "dark_pixel_ratio": self.dark_pixel_ratio,
            "low_sat_ratio": self.low_sat_ratio,
            "texture_std": self.texture_std,
            "feature_source": self.feature_source,
        }


def _hash_fallback(seed: str) -> np.ndarray:
    # TODO: 后续替换为真实视觉模型特征，fallback 仅用于联调阶段。
    raw = md5(seed.encode("utf-8")).digest()
    return np.frombuffer(raw, dtype=np.uint8).astype(np.float32) / 255.0


def _from_image(image_path: Path) -> VisualQualityFeatures:
    image = Image.open(image_path).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32) / 255.0

    hsv_img = image.convert("HSV")
    hsv = np.asarray(hsv_img, dtype=np.float32) / 255.0

    brightness = rgb.mean(axis=2)

    mean_rgb = rgb.mean(axis=(0, 1))
    saturation_mean = float(hsv[:, :, 1].mean())
    brightness_mean = float(brightness.mean())
    dark_pixel_ratio = float((brightness < 0.25).mean())
    low_sat_ratio = float((hsv[:, :, 1] < 0.2).mean())
    texture_std = float(brightness.std())

    return VisualQualityFeatures(
        mean_r=float(mean_rgb[0]),
        mean_g=float(mean_rgb[1]),
        mean_b=float(mean_rgb[2]),
        saturation_mean=saturation_mean,
        brightness_mean=brightness_mean,
        dark_pixel_ratio=dark_pixel_ratio,
        low_sat_ratio=low_sat_ratio,
        texture_std=texture_std,
        feature_source="image",
    )


def _from_fallback(seed: str) -> VisualQualityFeatures:
    arr = _hash_fallback(seed)
    return VisualQualityFeatures(
        mean_r=float(arr[:4].mean()),
        mean_g=float(arr[4:8].mean()),
        mean_b=float(arr[8:12].mean()),
        saturation_mean=float(arr[3:7].mean()),
        brightness_mean=float(arr[7:11].mean()),
        dark_pixel_ratio=float((arr < 0.2).mean()),
        low_sat_ratio=float((arr < 0.35).mean()),
        texture_std=float(arr.std()),
        feature_source="hash_fallback",
    )


def extract_visual_features(input_data: FruitGradeInput) -> VisualQualityFeatures:
    path = Path(input_data.image_path)
    if path.exists() and path.is_file():
        return _from_image(path)
    return _from_fallback(input_data.image_path)


# TODO: 后续接入分割/检测模型，提取缺陷面积、果形完整度和果蒂状态等特征。
