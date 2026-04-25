# AI 与 NestJS 集成说明（最小可运行）

更新时间：2026-04-21

## 1. 后端集成点

- 病害：`backend/src/modules/disease/*`
  - 入口：`POST /ai/disease/predict`、`POST /api/disease/predict`
  - 编排：上传 -> 推理客户端（主判断）-> LLM 建议增强 -> 落库
- 果实：`backend/src/modules/price/*`
  - 入口：`POST /ai/fruit/grade`
  - 编排：输入归一化 -> 感知 -> 规则裁决（主判断）-> LLM 建议增强 -> 响应 -> 落库
- 风险：`backend/src/modules/risk/*`
  - 入口：`GET /api/risk/:batchId`
  - 编排：特征汇总 -> 规则评估（主打级）-> LLM 建议增强 -> 落库
- 溯源：`backend/src/modules/trace/*`
  - 入口：`GET /api/trace/:code`
  - 编排：聚合溯源事实 -> LLM 买家说明增强 -> 返回
- LLM：`backend/src/llm/*`
  - 统一任务：`suggestDiseaseAdvice/suggestFruitAdvice/suggestRiskAdvice/suggestTraceAdvice`

## 2. Python 服务现状

当前仓库包含 `ai/service/app.py`，默认路由：

- `GET /health`
- `POST /predict/disease`
- `POST /predict/fruit`
- `POST /predict/risk`
- `POST /ai/disease/predict`（兼容）
- `POST /ai/fruit/perception`（兼容）
- `POST /ai/fruit/grade`（兼容）

后端 Fruit 感知客户端默认访问 `FRUIT_PERCEPTION_PATH=/ai/fruit/perception`，当前 Python 服务已提供该兼容路由。

## 3. 关键环境变量

```env
AI_SERVICE_URL=http://127.0.0.1:9001
AI_SERVICE_TIMEOUT_MS=15000
FRUIT_PERCEPTION_PATH=/ai/fruit/perception
ENABLE_AI_MOCK=false

DISEASE_AI_BASE_URL=http://127.0.0.1:9001
DISEASE_AI_PREDICT_PATH=/ai/disease/predict
DISEASE_AI_TIMEOUT_MS=15000

LLM_ENABLED=true
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

## 4. 联调步骤

1. 启动后端（`backend`）：`npm run start:dev`。  
2. 启动 AI 服务（`ai`）：`uvicorn service.app:app --host 0.0.0.0 --port 9001`。  
3. 配置 `.env` 并确认 `AI_SERVICE_URL` 可达。  
4. 优先验证：
   - `POST /ai/disease/predict`
   - `POST /ai/fruit/grade`
   - `GET /api/risk/:batchId`

## 5. 责任边界

- 后端决定核心业务输出与兼容字段。
- AI 服务提供可替换推理能力。
- LLM 仅负责说明与建议增强，失败不影响核心结果。
- LLM 不参与病害分类、分级定价、风险打级等确定性计算。

## 6. 建议任务统一输出与回退

- 建议任务统一结构：`title/summary/actions/riskNote`。
- 统一回退策略：
  - LLM 不可用或超时：返回模板化建议，不阻塞主流程。
  - LLM 输出结构异常：兼容提取失败则回退模板。
- 可观测字段：`taskType/promptVersion/model/latencyMs/success/fallback/errorCode`。

## 2026-04-21 Trace EVM 锚定联调补充

### Trace 责任边界

- `backend/src/modules/trace`：
  - 本地快照聚合 + 稳定序列化 + `sha256` 生成 `proofHash`。
  - verify 主判定只看本地 hash 比对结果。
  - EVM 锚定仅作增强证明，不替代主判定。

### Trace 相关配置

```env
TRACE_ANCHOR_ENABLED=false
TRACE_ANCHOR_PROVIDER=hash

EVM_RPC_URL=
EVM_PRIVATE_KEY=
EVM_CHAIN_ID=
EVM_CHAIN_NAME=sepolia
EVM_CONTRACT_ADDRESS=
```

启用 EVM 锚定示例：

```env
TRACE_ANCHOR_ENABLED=true
TRACE_ANCHOR_PROVIDER=evm
TRACE_CHAIN_PROVIDER=evm
TRACE_CHAIN_NETWORK=sepolia
```

### 合约与回写字段

- 合约：`backend/src/modules/trace/contracts/TraceAnchor.sol`
- ABI：`backend/src/modules/trace/contracts/TraceAnchor.json`
- 合约关键方法：`anchorTrace / getAnchor / exists / setWriter`
- 回写字段：`anchorStatus/txId/blockNumber/chainProvider/chainNetwork/anchoredAt`
