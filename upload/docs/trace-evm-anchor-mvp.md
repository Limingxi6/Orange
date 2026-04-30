# Trace EVM 测试网锚定联调（MVP）

更新时间：2026-04-22

## 1. 目标与边界

- `verified` 主判定仍由本地 hash 校验决定。
- EVM 锚定是增强能力，用于提供 `txId` 等链上证明。
- 链上仅写最小元数据：`traceCode + proofHash`。

## 2. 合约与工程位置

- 合约源码：`backend/src/modules/trace/contracts/TraceAnchor.sol`
- ABI：`backend/src/modules/trace/contracts/TraceAnchor.json`
- Hardhat 工程：`backend/src/modules/trace/contracts/`
- 部署脚本：`backend/src/modules/trace/contracts/scripts/deploy-trace-anchor.ts`

## 3. 部署步骤（PoC）

```bash
cd backend/src/modules/trace/contracts
npm install
cp .env.example .env
npm run compile
npm run deploy:sepolia
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

## 4. 后端配置

```env
TRACE_ANCHOR_ENABLED=true
TRACE_ANCHOR_PROVIDER=evm
TRACE_CHAIN_PROVIDER=evm
TRACE_CHAIN_NETWORK=sepolia

EVM_RPC_URL=...
EVM_PRIVATE_KEY=0x...
EVM_CHAIN_ID=11155111
EVM_CHAIN_NAME=sepolia
EVM_CONTRACT_ADDRESS=0x...
```

## 5. 联调闭环

1. 部署合约并拿到地址。  
2. 配置后端 `.env`。  
3. 启动后端服务。  
4. 触发 trace verify 或 trace 生成流程。  
5. 检查 `trace_records` 回写字段：`anchor_status`,`tx_id`,`chain_provider`,`chain_network`,`anchored_at`。  
6. 调用 `/api/trace/:code/verify` 验证返回增强字段。

## 6. 关键约束

- 锚定失败不应导致 `verified=false`。
- 锚定异常不应阻塞 trace 主流程。
- 禁止上传业务快照原文到链上。
