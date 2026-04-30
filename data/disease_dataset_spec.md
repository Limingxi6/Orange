# 病害识别训练数据规范（橘源通）

本文档用于规范 `ai/scripts/train_disease.py` 所需训练数据，适用于当前项目的病害分类模型（`normal/canker/anthracnose/mite`）。

## 1. 目标与适用范围

- 目标：统一病害识别训练数据的组织方式、字段要求和质量标准。
- 适用：数据采集、标注、清洗、训练前检查与交付。
- 当前训练脚本支持两种输入：
  - CSV 标注文件（推荐）
  - 目录结构（按类别或按 train/val/test 分层）

## 2. 数据结构要求

### 2.1 推荐结构（CSV + 图片目录）

```text
ai/
  data/
    disease_labels.csv
    images/
      train/
        normal/
        canker/
        anthracnose/
        mite/
      val/
        normal/
        canker/
        anthracnose/
        mite/
      test/
        normal/
        canker/
        anthracnose/
        mite/
```

### 2.2 CSV 字段定义

文件名建议：`ai/data/disease_labels.csv`

- 必填字段：
  - `image_path`：图片路径（相对 `image_root` 或绝对路径）
  - `label`：类别标签
- 可选字段：
  - `split`：数据集划分，取值仅允许 `train` / `val` / `test`

说明：
- 若 `split` 不填写，训练脚本将按配置比例自动切分（默认 `val=0.15`，`test=0.15`）。
- 若部分样本有 `split`、部分没有，当前实现会将空 `split` 视作 `train`。

### 2.3 标签定义

当前建议固定为以下四类（与 `config/disease_labels.example.yaml` 保持一致）：

- `normal`：健康
- `canker`：溃疡病
- `anthracnose`：炭疽病
- `mite`：红蜘蛛/螨害

## 3. 数据质量要求

### 3.1 图片要求

- 支持格式：`.jpg/.jpeg/.png/.bmp/.webp`
- 分辨率：建议最短边不低于 512 像素
- 清晰度：病斑区域可辨识，避免严重虚焦/抖动
- 光照：尽量包含晴天、阴天、逆光、早晚等不同条件
- 背景：尽量减少强干扰背景（杂乱叶片堆叠、遮挡过重）

### 3.2 标注要求

- 一图一主标签，标签语义清晰一致
- 同义标签统一（如仅用 `canker`，不要混用 `citrus_canker`）
- 文件路径必须真实存在，避免失效路径

### 3.3 划分要求

- 推荐比例：`train:val:test = 70:15:15`
- 避免数据泄漏：
  - 同一棵树同一时段连拍图不要跨集合
  - 同一病斑连续帧不要同时出现在训练和测试中

### 3.4 样本量建议

- 流程联调最小量：每类 50 张
- 可用基线：每类 200-500 张
- 上线建议：每类 1000+ 张，并覆盖季节/地区/设备差异

## 4. 示例数据（可直接参考）

### 4.1 CSV 示例（多条）

```csv
image_path,label,split
./images/train/normal/normal_yc_20260401_0001.jpg,normal,train
./images/train/normal/normal_yc_20260401_0002.jpg,normal,train
./images/train/normal/normal_cd_20260402_0001.jpg,normal,train
./images/train/normal/normal_gz_20260403_0001.jpg,normal,train
./images/train/canker/canker_yc_20260401_0001.jpg,canker,train
./images/train/canker/canker_yc_20260401_0002.jpg,canker,train
./images/train/canker/canker_cd_20260402_0001.jpg,canker,train
./images/train/canker/canker_gz_20260403_0001.jpg,canker,train
./images/train/anthracnose/anthracnose_yc_20260401_0001.jpg,anthracnose,train
./images/train/anthracnose/anthracnose_cd_20260402_0001.jpg,anthracnose,train
./images/train/anthracnose/anthracnose_cd_20260402_0002.jpg,anthracnose,train
./images/train/mite/mite_yc_20260401_0001.jpg,mite,train
./images/train/mite/mite_yc_20260401_0002.jpg,mite,train
./images/train/mite/mite_cd_20260402_0001.jpg,mite,train
./images/val/normal/normal_yc_20260410_0001.jpg,normal,val
./images/val/canker/canker_yc_20260410_0001.jpg,canker,val
./images/val/anthracnose/anthracnose_cd_20260410_0001.jpg,anthracnose,val
./images/val/mite/mite_gz_20260410_0001.jpg,mite,val
./images/test/normal/normal_cd_20260412_0001.jpg,normal,test
./images/test/canker/canker_cd_20260412_0001.jpg,canker,test
./images/test/anthracnose/anthracnose_yc_20260412_0001.jpg,anthracnose,test
./images/test/mite/mite_yc_20260412_0001.jpg,mite,test
```

### 4.2 无 `split` 的 CSV 示例（自动切分）

```csv
image_path,label
./images/all/normal/normal_0001.jpg,normal
./images/all/normal/normal_0002.jpg,normal
./images/all/canker/canker_0001.jpg,canker
./images/all/canker/canker_0002.jpg,canker
./images/all/anthracnose/anthracnose_0001.jpg,anthracnose
./images/all/anthracnose/anthracnose_0002.jpg,anthracnose
./images/all/mite/mite_0001.jpg,mite
./images/all/mite/mite_0002.jpg,mite
```

## 5. 训练使用方式

### 5.1 使用 CSV（推荐）

```bash
cd ai
python scripts/train_disease.py \
  --source data/disease_labels.csv \
  --source-type csv \
  --image-root data \
  --labels config/disease_labels.example.yaml \
  --out models/disease_classifier.pt \
  --label-out models/disease_label_mapping.json \
  --epochs 20
```

### 5.2 使用目录结构

```bash
cd ai
python scripts/train_disease.py \
  --source data/disease_images \
  --source-type dir \
  --labels config/disease_labels.example.yaml
```

## 6. 交付前检查清单

- [ ] CSV 必填列齐全（`image_path`、`label`）
- [ ] `label` 仅使用约定类别
- [ ] 所有图片路径存在且可读取
- [ ] 各类别数量大致均衡（建议最大最小不超过 3 倍）
- [ ] `val/test` 覆盖真实难样本（光照差、轻微病斑、遮挡）
- [ ] 无明显重复图、坏图、误标图

## 7. 常见问题

- Q: 可以先用公开数据训练吗？  
  A: 可以用于冷启动，但上线前建议用你们自采数据微调，避免域偏移。

- Q: 标签要不要加严重程度（轻/中/重）？  
  A: 当前模型是单标签分类，建议先保证病种标签质量，再考虑扩展多任务。

- Q: LLM 会参与训练吗？  
  A: 不会。LLM 仅用于解释文案，不替代病害分类模型。
