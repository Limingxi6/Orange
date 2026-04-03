# 橘源通 —— 真实接口清单

> 基于前端 Mock 数据和 services 层代码整理，供后端开发对照实现。
>
> **统一约定**
> - BaseURL：见 `services/config.js` ENV_MAP（dev / test / prod）
> - 请求头：`Content-Type: application/json`、`Authorization: Bearer <token>`
> - 统一响应格式：`{ code: 0, message: "ok", data: { ... } }`
> - 文件上传使用 `multipart/form-data`

---

## 一、首页（`pages/home/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 1 | 获取实时天气 | GET | `/api/weather` | `region_code` 地区编码 | `{ location, condition, temp, humidity, wind }` | 同风险预警页共用 |
| 2 | 获取风险摘要 | GET | `/api/risk/summary` | — | `{ riskSummary: "当前病害风险中等..." }` | 首页只需一行文案 |
| 3 | 获取最近批次 | GET | `/api/batches` | `page=1, limit=2, sort=latest` | `[ { id, name, status, date } ]` | 复用批次列表接口 |

---

## 二、批次列表（`pages/batch-list/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 4 | 获取批次列表 | GET | `/api/batches` | `keyword` 搜索词（可选）、`page`、`limit` | `[ { id, name, variety, plotName, stage, status, plantDate } ]` | — |
| 5 | 创建批次 | POST | `/api/batches` | `{ name, variety, plotName, area, plantDate }` | `{ id }` | — |

---

## 三、批次详情（`pages/batch-detail/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 6 | 获取批次详情 | GET | `/api/batches/:id` | 路径参数 `id` | `{ id, name, variety, plotName, plantDate, stage, status }` | — |
| 7 | 更新批次阶段 | PUT | `/api/batches/:id/stage` | `{ stage }` | `{ success: true }` | — |
| 8 | 获取批次日志 | GET | `/api/logs/batch/:batchId` | 路径参数 `batchId` | `[ { id, date, content, type } ]` | 复用农事日志接口 |

---

## 四、农事日志（`pages/farming-log/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 9 | 获取日志列表 | GET | `/api/logs/batch/:batchId` | 路径参数 `batchId`，可选 `type` 筛选 | `[ { id, time, type, content, operator, images, detail } ]` | type 枚举: 识别/浇水/施肥/喷药/修剪/采摘/分级/销售 |
| 10 | 新建日志 | POST | `/api/logs` | `{ batch_id, log_type, description, image_url, source }` | `{ id }` | source 可为 `disease_recognize` / `manual` |
| 11 | 获取日志类型 | GET | `/api/logs/types` | — | `[ { label, value, icon } ]` | 前端筛选标签 |

---

## 五、病害识别（`pages/disease-recognize/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 12 | AI 病害识别 | POST | `/ai/disease/predict` | `file`（图片文件）、`batch_id`（可选） | `{ label, confidence, severity, advice, needManualReview }` | multipart/form-data 上传；confidence 为 0~1 浮点数；severity 枚举: 高/中/低 |
| 13 | 病害识别历史 | GET | `/api/disease/records` | `batch_id`（可选） | `[ { id, date, label, confidence, severity, status } ]` | status 枚举: review/normal |

---

## 六、果实分级（`pages/fruit-grade/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 14 | AI 果实分级与定价 | POST | `/ai/fruit/grade` | `file`（图片文件）、`channel`（电商/批发/摆摊）、`packaging`（简装/礼盒）、`region` | `{ variety, grade, colorScore, defectRatio, sizeScore, maturityScore, retailMinPrice, retailMaxPrice, wholesaleMinPrice, wholesaleMaxPrice, reason, riskWarning, factors }` | multipart/form-data 上传；factors 为键值对如 `{ "市场基准价": "6.0 元/斤", "品质系数": "1.10", ... }` |
| 15 | 获取价格基准线 | GET | `/api/price/baseline` | `variety` 品种、`region` 地区 | `{ basePrice, unit, updateTime }` | — |
| 16 | 获取定价建议 | GET | `/api/price/suggestion/:batchId` | 路径参数 `batchId` | `{ suggestedRetailPrice, suggestedWholesalePrice, factors }` | — |

---

## 七、风险预警（`pages/risk-warning/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 17 | 获取实时天气 | GET | `/api/weather` | `region_code` | `{ location, condition, temp, humidity, wind }` | 同首页接口 #1 |
| 18 | 获取 15 天预报 | GET | `/api/weather/forecast` | `region_code`、`days=15` | `[ { date, day, icon, tempMin, tempMax, humidity, riskScore } ]` | riskScore 0~100 |
| 19 | 获取风险评估 | GET | `/api/risk/:batchId` | 路径参数 `batchId` | `{ level, levelText, reason, suggestion }` | level 枚举: high/mid/low |
| 20 | 获取风险历史 | GET | `/api/risk/history` | `batch_id`（可选）、`page`、`limit` | `[ { id, date, level, levelText, summary } ]` | — |

---

## 八、溯源查看（`pages/trace-view/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 21 | 获取溯源信息 | GET | `/api/trace/:batchId` | 路径参数 `batchId` | 见下方详细结构 | 一次性返回全部溯源数据 |
| 22 | 区块链验证 | GET | `/chain/verify/:batchId` | 路径参数 `batchId` | `{ status, message }` | status: verified/failed |
| 23 | 生成溯源二维码 | POST | `/api/qrcode/generate` | `{ batch_id }` | `{ qrcodeUrl, expireTime }` | — |

**接口 #21 返回结构详情：**

```json
{
  "batchInfo": {
    "name": "2026春-纽荷尔脐橙A区",
    "variety": "纽荷尔脐橙",
    "plotName": "东区3号地",
    "plotLocation": "湖北省宜城市",
    "area": "5亩",
    "plantDate": "2026-01-15",
    "stage": "果实膨大期",
    "status": "种植中"
  },
  "gradeInfo": {
    "grade": "一级果",
    "retailPrice": "6.8 ~ 8.2 元/斤",
    "wholesalePrice": "4.2 ~ 5.5 元/斤",
    "colorScore": 92,
    "sizeScore": 88,
    "maturityScore": 90,
    "defectRatio": 3
  },
  "timeline": [
    { "time": "2026-03-16 09:30", "type": "识别", "content": "AI 识别叶片..." }
  ],
  "diseaseRecords": [
    { "date": "2026-03-16", "label": "疑似柑橘溃疡病", "confidence": 91, "severity": "中", "status": "review" }
  ],
  "chainAnchors": [
    { "eventType": "批次创建", "time": "2026-01-15 10:00", "txId": "0xabc...", "status": "verified" }
  ],
  "overallChainStatus": "verified",
  "verifiedCount": 3,
  "totalAnchorCount": 4
}
```

---

## 九、产品二维码（`pages/product-qrcode/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 24 | 获取产品列表 | GET | `/api/products` | `page`、`limit` | `[ { id, batchName, variety, grade, status, price, qrcodeGenerated } ]` | status: 已上架/待上架 |
| 25 | 生成产品二维码 | POST | `/api/qrcode/generate` | `{ batch_id }` | `{ qrcodeUrl, expireTime }` | 同 #23 |

---

## 十、认证与用户（`pages/login/index`、`pages/mine/index`）

| # | 接口名 | 方法 | URL | 请求参数 | 返回字段 | 备注 |
|---|--------|------|-----|----------|----------|------|
| 26 | 获取用户信息 | GET | `/api/user/profile` | — | `{ nickname, avatar, phone, role, userId }` | — |
| 27 | 手机号登录 | POST | `/api/auth/login` | `{ phone, code }` | `{ token, userInfo }` | 返回 token 存入 Storage |
| 28 | 发送验证码 | POST | `/api/auth/send-code` | `{ phone }` | `{ success: true }` | 60s 限频 |
| 29 | 退出登录 | POST | `/api/auth/logout` | — | `{ success: true }` | 清除 token |

---

## 接口总览

| 序号 | 页面 | 接口名 | 方法 | URL |
|------|------|--------|------|-----|
| 1 | 首页 / 风险预警 | 获取实时天气 | GET | `/api/weather` |
| 2 | 首页 | 获取风险摘要 | GET | `/api/risk/summary` |
| 3 | 首页 / 批次列表 | 获取批次列表 | GET | `/api/batches` |
| 4 | 批次列表 | 创建批次 | POST | `/api/batches` |
| 5 | 批次详情 | 获取批次详情 | GET | `/api/batches/:id` |
| 6 | 批次详情 | 更新批次阶段 | PUT | `/api/batches/:id/stage` |
| 7 | 农事日志 / 批次详情 | 获取批次日志 | GET | `/api/logs/batch/:batchId` |
| 8 | 农事日志 | 新建日志 | POST | `/api/logs` |
| 9 | 农事日志 | 获取日志类型 | GET | `/api/logs/types` |
| 10 | 病害识别 | AI 病害识别 | POST | `/ai/disease/predict` |
| 11 | 病害识别 | 病害识别历史 | GET | `/api/disease/records` |
| 12 | 果实分级 | AI 果实分级与定价 | POST | `/ai/fruit/grade` |
| 13 | 果实分级 | 获取价格基准线 | GET | `/api/price/baseline` |
| 14 | 果实分级 | 获取定价建议 | GET | `/api/price/suggestion/:batchId` |
| 15 | 风险预警 | 获取 15 天预报 | GET | `/api/weather/forecast` |
| 16 | 风险预警 | 获取风险评估 | GET | `/api/risk/:batchId` |
| 17 | 风险预警 | 获取风险历史 | GET | `/api/risk/history` |
| 18 | 溯源查看 | 获取溯源信息 | GET | `/api/trace/:batchId` |
| 19 | 溯源查看 | 区块链验证 | GET | `/chain/verify/:batchId` |
| 20 | 产品二维码 / 溯源 | 生成溯源二维码 | POST | `/api/qrcode/generate` |
| 21 | 产品二维码 | 获取产品列表 | GET | `/api/products` |
| 22 | 认证 | 获取用户信息 | GET | `/api/user/profile` |
| 23 | 认证 | 手机号登录 | POST | `/api/auth/login` |
| 24 | 认证 | 发送验证码 | POST | `/api/auth/send-code` |
| 25 | 认证 | 退出登录 | POST | `/api/auth/logout` |

> **去重后共 25 个独立接口**，其中 2 个为 AI 推理接口（文件上传），3 个为认证接口，其余 20 个为常规 CRUD / 查询接口。
