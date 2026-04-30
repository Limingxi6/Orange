# models 目录说明

本目录用于存放训练后的模型文件，例如：
- `disease_classifier_leaves.pt`（PyTorch 叶片病虫害分类模型，当前默认接入）
- `disease_classifier.pt`（历史 PyTorch 病害分类模型）
- `disease_label_mapping.json`（标签映射）
- `risk_model.joblib`（可选）

建议按任务和版本组织，例如：
- `models/disease/v2026-04-13/disease_classifier_leaves.pt`
- `models/disease/v2026-04-13/disease_label_mapping.json`

TODO: 接入模型版本管理与模型元数据登记（数据版本、特征版本、评估指标）。
