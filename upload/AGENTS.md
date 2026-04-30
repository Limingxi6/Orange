# AGENTS.md

## 1. 项目简介

“橘源通”是一个 **微信小程序 + NestJS 后端 + Python AI 工程** 的农业数字化项目，核心业务包括：
- 批次管理
- 农事日志
- 病害识别
- 果实分级与定价
- 风险预警
- 二维码与溯源
- AI 结果解释、建议生成、问答与文案

协作目标：在不破坏现有联调能力的前提下，持续交付 **最小可运行（MVP）** 的稳定增量。

---

## 2. 目录结构说明

根目录关键结构：
- `backend/`：NestJS 后端
- `ai/`：Python AI 工程（训练/推理/规则/LLM 调用）
- `pages/`：小程序页面
- `services/`：小程序前端请求封装
- `docs/`：需求、接口、状态、AI 方案等文档

后端关键目录：
- `backend/src/modules/disease`：病害识别接口与服务
- `backend/src/modules/price`：果实分级/定价接口与服务
- `backend/src/modules/risk`：风险评估接口与服务
- `backend/src/modules/trace`：溯源接口与服务
- `backend/src/modules/log`：农事日志
- `backend/src/modules/weather`：天气服务
- `backend/src/llm`：统一大模型接入层（统一 client/service/prompts/types）

AI 工程关键目录：
- `ai/src/disease`：病害模型训练/评估/推理
- `ai/src/fruit_grade`：两段式分级定价
- `ai/src/risk`：规则引擎 + 模型预留 + LLM解释
- `ai/src/llm`：Python 侧 LLM 客户端与任务封装

---

## 3. 技术栈说明

- 小程序：微信原生小程序（JS/WXML/WXSS）
- 后端：NestJS 10、Prisma、MySQL、Redis、JWT、Swagger
- AI：Python（PyTorch、scikit-learn、规则引擎）
- LLM：OpenAI-compatible Chat Completions API（统一通过后端 `src/llm` 调用）

---

## 4. 开发约定

1. **优先最小可运行方案**，避免过度设计。
2. 增量改动优先复用现有 module/service/dto，除非明确需要新模块。
3. 新增配置必须同时更新：
   - `backend/.env.example`
   - `backend/src/config/configuration.ts`
   - `backend/src/config/env.validation.ts`
   - 相关文档
4. 接口输出保持 `{ code, message, data }` 统一响应约定。
5. 所有异常走后端统一错误体系（`BusinessException` + 错误码）。

---

## 5. 命名规范

### 后端（NestJS）
- 文件：`kebab-case.ts`
- 类：`PascalCase`
- DTO：`XxxDto`
- Service：`XxxService`
- Module：`XxxModule`
- Controller：`XxxController`

### AI（Python）
- 文件：`snake_case.py`
- 函数：`snake_case`
- 数据结构：优先 `dataclass`
- 配置文件：`*.example.yaml`

### 字段命名
- 后端输出字段优先保持历史兼容（例如 `batchId` 与必要的 legacy 字段并存）
- 新增字段尽量使用 camelCase（对外 API）

---

## 6. 不要随意破坏的现有接口和字段

以下接口与字段已被前端联调依赖，默认视为稳定：

1. `POST /ai/disease/predict`
- 关键输出：`label`, `confidence`, `severity`, `advice`, `needManualReview`

2. `POST /ai/fruit/grade`
- 关键输出：
  `variety`, `grade`, `colorScore`, `defectRatio`, `sizeScore`, `maturityScore`,
  `retailMinPrice`, `retailMaxPrice`, `wholesaleMinPrice`, `wholesaleMaxPrice`,
  `reason`, `riskWarning`, `factors`

3. `GET /api/risk/:batchId`
- 关键输出：`level`, `levelText`, `reason`, `suggestion`

4. 风险相关兼容查询接口
- `GET /api/risk/assessment?batchId=...`
- `GET /api/risk/history`
- `GET /api/risk/summary`

5. 认证头与统一响应
- `Authorization: Bearer <token>`
- `{ code, message, data }`

**禁止行为**：
- 未经评估直接删除字段
- 修改字段语义但保留原名
- 调整接口路径而不保留兼容路由

---

## 7. AI 模块开发原则

1. **传统模型/规则优先负责核心确定性计算**：
- 病害分类
- 果实评分/分级/定价计算
- 风险等级判定

2. AI 模块设计遵循：
- 可替换（模型工厂、规则配置化）
- 可解释（reason/factors/规则命中）
- 可回退（远程服务失败时 fallback）

3. Python 服务接入策略：
- 默认通过 HTTP 调用
- 后端需保留本地规则兜底，避免 AI 服务不可用导致主流程中断

4. 数据与模型管理：
- `models/` 仅存工件，不把临时缓存提交到仓库
- 样例数据与真实数据严格分离

---

## 8. 大模型 API 接入原则

1. 统一入口：`backend/src/llm`
- 统一 client（超时、重试、日志脱敏）
- 统一 prompts 管理
- 统一结构化输出解析

2. LLM 职责边界（必须遵守）：
- 允许：解释、建议、问答、文案生成
- 禁止：直接替代病害分类、价格计算、风险打级

3. Prompt 规范：
- 明确“仅基于输入字段作答，不得臆造”
- 农业诊断内容必须保守表达
- 低置信度必须输出不确定性提示
- 输出中文、简洁、可执行

4. Prompt 可维护/可审计：
- 模板集中管理（`llm.prompts.ts` 或 `ai/prompts/`）
- 变更需记录目的与影响范围

5. 安全要求：
- 日志中不得泄露 API Key 与敏感原文
- 结构化输出解析失败时必须有 deterministic fallback

---

## 9. 测试与验证命令

### 后端
```bash
cd backend
npm run build
npm test -- --runInBand
```

针对 LLM 最小测试：
```bash
cd backend
npm test -- llm.utils.spec.ts llm.service.spec.ts ai-narrative.service.spec.ts --runInBand
```

### AI（Python）
```bash
cd ai
pip install -r requirements.txt
python scripts/train_disease.py --help
python scripts/predict_disease.py --help
python scripts/predict_fruit_grade.py --help
python scripts/risk_assess.py --help
```

---

## 10. 修改代码前后的检查项

### 修改前
1. 确认目标接口当前响应结构与字段。
2. 确认是否已有现成 module/service/dto 可复用。
3. 明确此次改动是否涉及配置或 Prompt。

### 修改后
1. 编译通过（`npm run build` / Python 语法检查）。
2. 关键接口返回字段未破坏（至少手工 smoke test）。
3. 新增环境变量已完成 3 处同步：
- `.env.example`
- `configuration.ts`
- `env.validation.ts`
4. 新增/变更 Prompt 可追踪（位置固定、命名清晰）。
5. 失败场景可回退（LLM失败、AI服务超时、非JSON输出）。

---

## 11. 文档更新要求

任何以下改动，必须同步更新文档（至少 `docs/` 下对应文档）：
- 接口路径、请求参数、响应字段
- 新增/修改环境变量
- 规则阈值与评分逻辑
- Prompt 模板与任务方法
- AI 服务联调方式

建议更新目标：
- `docs/api-interface-list.md`（接口字段变化）
- `docs/project-status.md`（进展与待办）
- `docs/ai-solution.md`（AI 总体方案变化）
- `docs/risk-engine-design.md`（风险规则变化）
- `docs/ai-backend-integration.md`（后端集成变化）

---

## 强约束（必须执行）

1. 优先最小可运行方案，避免过度设计。  
2. 传统模型负责分类、评分、规则打分。  
3. 大模型 API 负责解释、建议、问答、文案生成。  
4. 不允许让大模型直接替代核心确定性计算逻辑。  
5. 任何接口字段修改都要同步更新文档。  
6. 涉及 Prompt 的地方必须可维护、可审计。  
7. 涉及农业建议时，输出必须保守、明确、不可臆造。  
