# Unified LLM Layer

目录：`src/llm`

## 环境变量

支持以下变量（优先级：`OPENAI_*` > `DEEPSEEK_*` > `LLM_*`）：
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_MS`
- `OPENAI_MAX_RETRIES`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_TIMEOUT_MS`
- `DEEPSEEK_MAX_RETRIES`

兼容旧变量：`LLM_*`。

`OPENAI_BASE_URL/DEEPSEEK_BASE_URL` 可配置到 `.../v1`，内部会自动避免 `.../v1/v1/chat/completions` 的重复拼接。

## 核心能力

- `LlmClient`: 统一请求、超时、重试、脱敏日志
- `LlmService`: 业务任务封装
  - `suggestDiseaseAdvice(input)`
  - `suggestFruitAdvice(input)`
  - `suggestRiskAdvice(input)`
  - `suggestTraceAdvice(input)`
  - `answerUserQuestion(input)`
- 兼容封装（历史调用）：
  - `explainDiseaseResult` / `explainFruitGradeResult` / `explainRiskResult` / `generateTraceSummary`
- `llm.prompts.ts`: 分任务 Prompt 模板
  - `suggestDiseaseAction`
  - `suggestFruitGradeAction`
  - `suggestRiskAction`
  - `suggestTraceSummary`
- `llm.utils.ts`: JSON 解析与兼容提取

## 输出结构

建议任务统一输出：

```json
{
  "title": "...",
  "summary": "...",
  "actions": ["...", "..."],
  "riskNote": "..."
}
```

## 回退与观测

- LLM 调用失败、超时、结构化解析失败时，回退 deterministic 模板建议，不阻断主流程。
- 每次任务记录观测字段：
  - `taskType`
  - `promptVersion`
  - `model`
  - `latencyMs`
  - `success`
  - `fallback`
  - `errorCode`
- 日志不输出 API Key 和原始敏感文本。
