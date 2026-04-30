# 橘源通 API 接口清单（按当前代码）

更新时间：2026-04-26  
适用范围：`pages/*` + `services/*` + `backend/src/modules/*`

## 统一约定

- 全局前缀：`/api`
- 前缀例外：
  - `POST /ai/disease/predict`
  - `POST /ai/fruit/grade`
- 认证：`Authorization: Bearer <token>`（登录/发码免认证）
- 统一响应：`{ code, message, data }`

## 1. 认证与用户

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 登录 | POST | `/api/auth/login` | `phone,password` |
| 发送验证码 | POST | `/api/auth/send-code` | 开发环境可返回 `debugCode` |
| 当前资料 | GET | `/api/auth/profile` | 当前登录用户信息 |
| 退出 | POST | `/api/auth/logout` | `success:true` |
| 当前用户 | GET | `/api/users/me` | 用户信息 |
| 指定用户 | GET | `/api/users/:userId` | 管理员权限 |
| 业务范围示例 | GET | `/api/users/:userId/business-scope` | 本人或管理员 |

## 2. 批次管理

| 接口 | 方法 | 路径 | 关键参数 |
|---|---|---|---|
| 列表 | GET | `/api/batches` | `keyword,stage,page,limit/pageSize,sort` |
| 详情 | GET | `/api/batches/:id` | `id` |
| 创建 | POST | `/api/batches` | `batchNo? orchardName variety plantingDate ...` |
| 阶段更新 | PUT | `/api/batches/:id/stage` | `stage` |
| 删除 | DELETE | `/api/batches/:id` | 仅 `admin` 或批次负责人；事务内级联删除日志/病害/风险/分级/产品/溯源关联数据 |

## 3. 农事日志

| 接口 | 方法 | 路径 | 关键参数 |
|---|---|---|---|
| 列表 | GET | `/api/logs` | `batchId` 必填，`type` 可选 |
| 新增 | POST | `/api/logs` | 兼容 `batchId/batch_id`、`type/log_type`、`content/description` |
| 类型字典 | GET | `/api/logs/types` | 固定枚举 |

## 4. 病害识别

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 主兼容入口 | POST | `/ai/disease/predict` | `multipart/form-data`，`file,batchId/batch_id,imageUrl` |
| API 入口 | POST | `/api/disease/predict` | 同上 |
| 记录查询 | GET | `/api/disease/records` | `batchId,page,pageSize` |

稳定关键输出（兼容字段）：

- `label`
- `confidence`（对外展示/LLM 入参使用校准值，保持在 0.80-0.97）
- `severity`
- `advice`
- `needManualReview`
- 建议增强字段（新增）：
  - `aiSuggestion` / `suggestionDetail`
  - `enhancedSuggestion`

## 5. 果实分级与定价

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| AI 分级定价 | POST | `/ai/fruit/grade` | 文件上传或 JSON，兼容 `packageType/packaging` |
| 规则分级定价 | POST | `/api/price/grade` | 结构化入参 |
| 基准价 | GET | `/api/price/baseline` | `variety,region` |
| 定价建议 | GET | `/api/price/suggestion` | `batchId` 或 `grade/channel/packageType` |

稳定关键输出：

- `gradeCode, grade`
- `colorScore, defectRatio, sizeScore, maturityScore`
- `retailMinPrice, retailMaxPrice, wholesaleMinPrice, wholesaleMaxPrice`
- `reason, riskWarning, factors`
- `source, modelVersion, requestId`
- 建议增强字段（新增）：
  - `explanation`
  - `recommendation`（`title/summary/actions/riskNote`）

## 6. 风险预警

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 摘要 | GET | `/api/risk/summary` | 可带 `batchId` |
| 评估（query） | GET | `/api/risk/assessment` | `batchId` 必填 |
| 评估（兼容） | GET | `/api/risk/:batchId` | 与 assessment 同源 |
| 历史 | GET | `/api/risk/history` | 兼容 `batchId/batch_id` + 分页 |

稳定关键输出（页面兼容）：

- `level`
- `levelText`
- `reason`
- `suggestion`
- 建议增强字段（新增）：
  - `aiAdvice`（`title/summary/actions/riskNote`）
  - `enrichedSuggestion`

## 7. 产品、二维码、溯源

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 产品列表 | GET | `/api/products` | 支持筛选和分页 |
| 生成二维码 | POST | `/api/products/:id/qrcode` | `id` 是产品 ID，优先生成微信小程序码（失败自动回退普通二维码） |
| 溯源详情 | GET | `/api/trace/:code` | 支持 traceCode 与数字 ID |
| 溯源校验 | GET | `/api/trace/:code/verify` | 返回校验与锚定信息 |

溯源校验增强字段：

- `anchorStatus`
- `txId`
- `blockNumber`
- `chainProvider`
- `chainNetwork`
- `anchoredAt`

溯源详情建议增强字段（新增）：

- `traceSummary`（`title/summary/actions/riskNote`）
- `buyerSummary`（同结构）
- `traceNarrative`（兼容文本）

产品二维码返回增强字段：

- `qrcodeType`：`mini_program` / `normal`
- `qrcodeFallback`：是否从小程序码回退为普通二维码
- `qrcodeFallbackReason`：回退原因（可为空）

## 8. 天气与上传

| 接口 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 当前天气 | GET | `/api/weather/current` | 兼容 `regionCode/region_code` |
| 天气预报 | GET | `/api/weather/forecast` | `days` 默认 15 |
| 图片上传 | POST | `/api/upload/image` | `multipart/form-data`，字段 `file` |

## 9. 兼容与对齐说明

- 小程序已对齐二维码路由：`/api/products/:id/qrcode`。
- 小程序天气已对齐：`/api/weather/current` 与 `/api/weather/forecast`。
- 风险评估前端默认走 `/api/risk/:batchId`，后端保留 `/api/risk/assessment`。
