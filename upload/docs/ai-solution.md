# 橘源通 AI 落地方案（按当前实现）

更新时间：2026-04-21

## 1. 设计原则

- 决策层：传统模型/规则引擎。
- 表达层：LLM（解释、建议、问答、文案）。
- 严禁：LLM 直接替代病害分类、分级定价、风险打级。

## 2. 当前架构分工

### 2.1 病害

- 后端入口：`POST /ai/disease/predict`、`POST /api/disease/predict`。
- 主链路：上传 -> `DiseaseInferenceClient` -> `DiseaseRecord` 落库。
- 解释增强：`AiNarrativeService.explainDiseaseResult()`。
- 回退：远程推理不可用时由推理客户端回退。

### 2.2 果实分级与定价

- 后端入口：`POST /ai/fruit/grade`。
- 感知层：`FruitInferenceClient`（远程）+ 本地 fallback。
- 决策层：`price-engine.ts`（`determineGrade/calculatePrice`）。
- 解释增强：`AiNarrativeService.explainFruitGradeResult()`。
- 落库：`fruit_grade_records`（含 `requestId`、`engineSource`、`modelVersion`）。

### 2.3 风险

- 后端入口：`GET /api/risk/:batchId`（兼容 `assessment`）。
- 决策层：`RiskEngineService` 规则评估。
- 解释增强：`AiNarrativeService.polishRiskAssessment()`，仅润色文本。
- 记录：`risk_records` 持久化。

### 2.4 LLM 统一层

- 目录：`backend/src/llm`。
- 组件：`LlmClient`、`LlmService`、`llm.prompts.ts`、`llm.utils.ts`。
- 策略：结构化输出优先，失败 deterministic fallback。

## 3. 路线图（稳态迭代）

1. 病害：持续替换/优化远程模型，保持后端回退不断链。  
2. 果实：先保证感知路径和后端 `FRUIT_PERCEPTION_PATH` 一致，再迭代视觉特征质量。  
3. 风险：先规则参数化，再引入模型概率作为“上调门控”。  
4. LLM：补齐观测指标（tokens/latency/promptVersion）并持续审计提示词。

## 4. 数据与可追溯性要求

- 病害：保留 `rawResult/modelVersion/needManualReview`。
- 分级：保留感知源、规则决策源、版本号与请求 ID。
- 风险：保留规则命中与来源快照。
- 文档与接口变更必须同步更新 `docs/*`。
