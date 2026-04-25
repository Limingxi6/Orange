# 详细设计-AI链路

更新时间：2026-04-22

## 1. 目标

明确 AI 与规则、LLM 的协作边界，保证“可解释 + 可回退 + 可审计”。

## 2. 代码分布

- 后端 AI 编排：`backend/src/modules/ai`
- 后端 LLM 统一层：`backend/src/llm`
- 病害/分级/风险业务编排：`backend/src/modules/disease|price|risk`
- Python AI：`ai/src`、`ai/service`

## 3. 病害链路

1. 小程序上传图片。  
2. 后端 `DiseaseService` 调 `DiseaseInferenceClient`。  
3. 推理结果落库 `disease_records`。  
4. `AiNarrativeService` 生成解释建议。  
5. 返回兼容字段供前端展示。

特点：

- 支持 `batchId/batch_id`。
- 低置信度可标记 `needManualReview`。

## 4. 果实分级链路

1. 输入归一化（渠道/包装/数值特征）。  
2. 感知层：`FruitInferenceClient` 调远程，失败回退本地规则感知。  
3. 决策层：`price-engine` 统一输出等级与价格区间。  
4. 解释层：LLM 生成原因文案（失败回退模板）。  
5. 落库 `fruit_grade_records`。

特点：

- `source.engine` 标识感知来源。
- `source.decision` 固定规则裁决。

## 5. 风险链路

1. 聚合天气、病害、农事数据。  
2. 规则引擎计算 `overallLevel`。  
3. LLM 对 `reason/suggestion` 做文本优化。  
4. 落库 `risk_records` 并返回兼容字段。

特点：

- LLM 不得修改风险等级。

## 6. LLM 统一层机制

- `LlmClient`：超时、重试、脱敏日志。
- `LlmService`：任务化方法。
- `llm.prompts.ts`：提示词集中管理。
- `llm.utils.ts`：结构化输出解析与兼容提取。

## 7. 配置与路由注意事项

- 病害远程：`DISEASE_AI_BASE_URL + DISEASE_AI_PREDICT_PATH`
- 感知远程：`AI_SERVICE_URL + FRUIT_PERCEPTION_PATH`
- 若 Python 服务路由不同，需要通过环境变量对齐。

## 8. 质量保障建议

1. 对三条 AI 主链路建立契约测试。  
2. 记录回退触发率并定期分析。  
3. 对提示词版本做变更记录与灰度评估。
