# AI Skeleton (MVP)

This directory contains training/inference skeletons for traditional models.

- `disease/`: image disease classification scaffolding.
- `fruit/`: fruit grading and pricing feature model scaffolding.

These scripts are intentionally lightweight placeholders so backend APIs can be
integrated first, then replaced with real model pipelines.

## Suggested workflow

1. Prepare datasets.
2. Implement feature extraction and training in each `train.py`.
3. Export model artifacts (`.onnx`, `.joblib`, `.pt`, etc.).
4. Implement online inference in each `infer*.py`.
5. Point NestJS service adapters to the deployed inference endpoints.

