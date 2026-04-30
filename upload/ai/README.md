# Orange AI 工程（MVP）

本目录是“橘源通”AI能力的最小可运行工程，覆盖：
- 病害识别（PyTorch 分类训练/评估/推理）
- 果实分级与定价（两段式：特征提取 -> 规则分级与区间定价）
- 风险评估（规则引擎主导 + LightGBM/XGBoost 预留 + LLM解释增强）
- 大模型解释层（仅做说明文案，不替代核心计算）

## 1. 快速开始

```bash
cd ai
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`requirements.txt` 已包含 `torch/torchvision`。如需 GPU，请替换成匹配 CUDA 的 wheel。

## 2. 果实分级 V1.5（重点）

### 2.1 数据标注与训练 SOP

- 文档：`docs/fruit-grade-training-sop.md`
- 数据目录：`ai/datasets/fruit_grade/v1/`

### 2.2 数据质检（新增）

```bash
# 在仓库根目录执行
python ai/scripts/check_fruit_grade_dataset.py --dataset-root ai/datasets/fruit_grade/v1

# 严格模式（warning 也返回非 0）
python ai/scripts/check_fruit_grade_dataset.py --dataset-root ai/datasets/fruit_grade/v1 --strict

# 如需检查图片是否齐全
python ai/scripts/check_fruit_grade_dataset.py --dataset-root ai/datasets/fruit_grade/v1 --require-images
```

### 2.3 表格分级模型训练（新增）

```bash
cd ai
python scripts/train_fruit_grade_model.py \
  --dataset-root datasets/fruit_grade/v1 \
  --output-model models/fruit_grade/grade_model.joblib \
  --test-size 0.2 \
  --random-state 42
```

### 2.4 训练输出

- `modelPath`
- `samples`
- `classes`
- `metrics.accuracy`
- `metrics.macroF1`

说明：样本过少或单类时会跳过验证集评估，并在 `metrics.note` 提示。

## 3. AI HTTP 服务（外部模型 API 网关 + 本地兜底）

```bash
cd ai
copy .env.example .env
uvicorn service.app:app --host 0.0.0.0 --port 9001
```

说明：
- `POST /ai/disease/predict`：优先本地病害模型识别，LLM 仅做建议增强；本地模型失败时回退规则。
- `POST /ai/fruit/perception`：仅输出感知特征，不输出最终价格。
- `POST /ai/fruit/grade`：默认本地规则链路；若存在 `FRUIT_GRADE_MODEL_PATH`（或默认 `models/fruit_grade/grade_model.joblib`）则优先使用训练表格模型做分级，定价仍走本地规则。
- `POST /predict/risk`：本地规则主导风险等级，外部 API 仅润色 `reason/suggestion`。

## 4. 其他模块

病害、风险相关说明与命令保持不变，可继续参考现有脚本：
- `scripts/train_disease.py`
- `scripts/predict_disease.py`
- `scripts/risk_assess.py`
- `scripts/predict_fruit_grade.py`

### 2.5 自动下载 + 转换到契约（新增）

脚本：`scripts/bootstrap_fruit_grade_data.py`

Kaggle 一键：
```bash
python scripts/bootstrap_fruit_grade_data.py bootstrap-kaggle \
  --dataset-root datasets/fruit_grade/v1 \
  --raw-dir datasets/fruit_grade/raw/kaggle \
  --kaggle-slug shruthiiiee/orange-quality
```

Zenodo(YOLO) 一键：
```bash
python scripts/bootstrap_fruit_grade_data.py bootstrap-zenodo-yolo \
  --dataset-root datasets/fruit_grade/v1 \
  --raw-dir datasets/fruit_grade/raw/zenodo \
  --record-id 17866344 \
  --source-name campaneta_zenodo
```

本地转换：
```bash
python scripts/bootstrap_fruit_grade_data.py convert-tabular --dataset-root datasets/fruit_grade/v1 --csv-path path/to/source.csv --source-name local_csv
python scripts/bootstrap_fruit_grade_data.py convert-image-classification --dataset-root datasets/fruit_grade/v1 --source-dir path/to/classification_dataset --source-name local_cls
python scripts/bootstrap_fruit_grade_data.py convert-yolo --dataset-root datasets/fruit_grade/v1 --source-dir path/to/yolo_dataset --source-name local_yolo
```

转换后建议立刻跑：
```bash
python scripts/check_fruit_grade_dataset.py --dataset-root datasets/fruit_grade/v1 --strict
```
