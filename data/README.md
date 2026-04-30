# data 目录说明

## 1. 病害识别样本格式

### CSV 格式（推荐）
文件：`disease_labels.sample.csv`

必填列：
- `image_path`: 图片路径（可相对 `image_root`）
- `label`: 类别标签（例如 normal/canker/anthracnose/mite）

可选列：
- `split`: `train|val|test`，不填时按 `val_ratio/test_ratio` 自动分割

示例：
```csv
image_path,label,split
./images/train/normal_001.jpg,normal,train
./images/val/canker_001.jpg,canker,val
./images/test/mite_001.jpg,mite,test
```

### 目录格式
方式 A（显式分割）：
```text
data/disease_images/
  train/
    normal/*.jpg
    canker/*.jpg
  val/
    normal/*.jpg
  test/
    canker/*.jpg
```

方式 B（仅类别目录，自动分割）：
```text
data/disease_images/
  normal/*.jpg
  canker/*.jpg
  anthracnose/*.jpg
  mite/*.jpg
```

## 2. 其他样例
- `fruit_features.sample.csv`: 果实分级样例特征
- `sample_fruit.jpg`: 果实分级推理示例图片
- `risk_events.sample.json`: 风险评估样例输入

> 当前样例用于结构说明，不包含可直接训练的真实生产数据。
