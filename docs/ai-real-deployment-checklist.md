# AI 真实上线检查清单（基于当前仓库）

更新时间：2026-04-21

## 1. 预检结论

当前仓库具备 MVP 上线主链路，但上线前必须完成配置收敛与链路对齐。

## 2. 必做项（P0）

1. 关闭前端生产 mock 回退。  
2. 配置并验证 `AI_SERVICE_URL`。  
3. 对齐 Fruit 感知路径：`FRUIT_PERCEPTION_PATH` 与 Python 实际路由一致。  
4. 确认 `WEATHER_PROVIDER=real`（默认即 real），并校验真实天气接口可达。  
5. 完成 3 条核心接口契约回归：
   - `/ai/disease/predict`
   - `/ai/fruit/grade`
   - `/api/risk/:batchId`

## 3. 建议项（P1）

1. 为 `logout` 增加 token 失效策略（黑名单或短 token + refresh）。  
2. 增加 AI 调用观测（耗时、失败率、回退率）。  
3. 定期核查 `fruit_grade_records` 数据质量与缺失字段。

## 4. 配置核对

- 后端：`backend/.env` 必须对齐 `configuration.ts` 与 `env.validation.ts`。
- 小程序：`services/config.js` 的 `CURRENT_ENV`、`USE_MOCK`、`MOCK_FALLBACK` 必须符合环境策略。
- LLM：建议生产启用 `LLM_ENABLED=true`，并使用真实密钥。

## 5. 联调验收标准

- 业务返回必须满足 `{ code, message, data }`。
- 稳定接口关键字段不得缺失：
  - 病害：`label/confidence/severity/advice/needManualReview`
  - 分级：`grade`、四类分数、四个价格区间字段、`reason/riskWarning/factors`
  - 风险：`level/levelText/reason/suggestion`
- 远程 AI 不可用时，后端仍能返回可用回退结果。
