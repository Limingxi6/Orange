# 果实分级训练与评估 SOP（V1.5）

更新时间：2026-04-21

## 1. 目标与边界

- 目标：提升感知层质量（`colorScore/defectRatio/sizeScore/maturityScore`）。
- 边界：最终等级与价格由后端规则引擎裁决。

## 2. 数据契约

目录：`ai/datasets/fruit_grade/v1/`

- `images/{image_id}.jpg`
- `features.csv`
- `labels.csv`

`features.csv`：`image_id,color_score,defect_ratio,diameter_mm,brix,weight_g,region,channel,package_type`  
`labels.csv`：`image_id,grade_code,target_retail_price,target_wholesale_price`

## 3. 质检命令

```bash
cd ai
python scripts/check_fruit_grade_dataset.py --dataset-root datasets/fruit_grade/v1
python scripts/check_fruit_grade_dataset.py --dataset-root datasets/fruit_grade/v1 --strict
```

## 4. 训练命令

```bash
cd ai
python scripts/train_fruit_grade_model.py \
  --dataset-root datasets/fruit_grade/v1 \
  --output-model models/fruit_grade/grade_model.joblib \
  --test-size 0.2 \
  --random-state 42
```

## 5. 评估门槛（建议）

- `accuracy >= 0.80`
- `macro_f1 >= 0.75`
- 分区域/渠道/包装做切片评估，不只看总体分数。

## 6. 与后端对接要求

- 后端感知路径默认 `FRUIT_PERCEPTION_PATH=/ai/fruit/perception`。
- 若 AI 服务仍仅暴露 `/predict/fruit` 或 `/ai/fruit/grade`，需通过环境变量调整并记录版本。
- 上线响应建议保留：`source.engine`、`modelVersion`、`requestId`。

## 7. 数据导入脚本

脚本：`ai/scripts/bootstrap_fruit_grade_data.py`

- Kaggle 导入：`bootstrap-kaggle`
- Zenodo YOLO 导入：`bootstrap-zenodo-yolo`
- 本地转换：`convert-tabular` / `convert-image-classification` / `convert-yolo`

导入后必须再次执行 `--strict` 质检。
