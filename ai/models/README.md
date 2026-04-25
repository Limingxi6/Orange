# models 目录说明

本目录用于存放训练后的模型文件，例如：
- `disease_classifier.pt`（PyTorch 病害分类模型）
- `disease_label_mapping.json`（标签映射）
- `risk_model.joblib`（可选）

建议按任务和版本组织，例如：
- `models/disease/v2026-04-13/disease_classifier.pt`
- `models/disease/v2026-04-13/disease_label_mapping.json`

TODO: 接入模型版本管理与模型元数据登记（数据版本、特征版本、评估指标）。
