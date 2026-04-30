# 风险预警引擎设计（MVP 实况）

更新时间：2026-04-21

## 1. 目标

为 `GET /api/risk/:batchId` 提供可解释、可回放、可扩展的风险评估。

## 2. 现行实现

- 引擎位置：`backend/src/modules/risk/risk-engine.service.ts`
- 服务编排：`backend/src/modules/risk/risk.service.ts`
- 输出字段：
  - 核心兼容：`level`,`levelText`,`reason`,`suggestion`
  - 扩展：`overallLevel`,`riskItems`,`suggestions`,`recordId`,`createdAt`

## 3. 输入特征（当前）

- 批次阶段：`batch.stage`
- 天气：`weatherCache.currentData/forecastData`
- 病害近 7 天统计：`disease_records`
- 灌溉日志：`farming_logs` 中 `irrigation/浇水`

## 4. 规则与阈值（当前）

- 病害扩散风险：未来 3 天降雨 + 敏感阶段。
- 干旱胁迫风险：高温 + 多日未灌溉。
- 病害历史风险：近 7 天病害记录数/高风险记录。
- 总分映射：
  - `>=60`: `high`
  - `30~59`: `mid`
  - `<30`: `low`

## 5. LLM 介入方式

- 接口：`AiNarrativeService.polishRiskAssessment`
- 作用：仅润色 `reason/suggestion`
- 约束：不得改变规则判定等级。

## 6. 已知边界

- 当前天气数据读取是按“最近缓存”聚合，需结合批次地域继续增强精度。
- 风险模型化（GBDT 等）尚属后续迭代，当前以规则主导。
