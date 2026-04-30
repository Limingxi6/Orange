"""Disease module for training, inference and explanation."""

from .predict import predict_disease
from .train import TrainConfig, train_disease_model

__all__ = [
    "predict_disease",
    "TrainConfig",
    "train_disease_model",
]
