# TraceAnchor EVM 测试网 PoC（Hardhat）

本目录提供 TraceAnchor 合约的最小可用部署工程，用于后端自动锚定 `traceCode + proofHash`。

## 1. 工程结构

```text
backend/src/modules/trace/contracts
├─ contracts/
│  └─ TraceAnchor.sol               # hardhat 编译入口（import 复用上层 TraceAnchor.sol）
├─ TraceAnchor.sol                  # 实际合约源码（后端与文档统一引用）
├─ TraceAnchor.json                 # 部署脚本自动更新（contractName + abi）
├─ hardhat.config.ts
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ scripts/
│  └─ deploy-trace-anchor.ts
└─ deployments/
   └─ .gitkeep
```

说明：`contracts/TraceAnchor.sol` 仅作为 Hardhat 编译入口，通过 import 复用上层 `TraceAnchor.sol`，不重复维护第二份合约逻辑。

## 2. 依赖安装

```bash
cd backend/src/modules/trace/contracts
npm install
```

## 3. 环境变量配置

```bash
# Linux / macOS
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

编辑 `.env`（最小必填）：

```env
EVM_RPC_URL=https://sepolia.infura.io/v3/<your_api_key>
EVM_PRIVATE_KEY=0x<your_private_key>
EVM_CHAIN_ID=11155111
EVM_CHAIN_NAME=sepolia
EVM_INITIAL_OWNER=
```

## 4. 编译合约

```bash
npm run compile
```

## 5. 部署到测试网（Sepolia）

```bash
npm run deploy:sepolia
```

部署脚本会：

1. 从环境变量读取 `EVM_RPC_URL`、`EVM_PRIVATE_KEY`。
2. 部署 `TraceAnchor(initialOwner)`（未设置 `EVM_INITIAL_OWNER` 时使用部署者地址）。
3. 输出：
   - `contract address`
   - `network name`
   - `deployer address`
   - `tx hash`
4. 写出后端可直接使用的产物：
   - `TraceAnchor.json`（ABI）
   - `deployments/sepolia.json`（地址 + 网络 + tx）
   - `deployments/sepolia.backend.env`（可粘贴到后端 `.env` 的配置片段）

`deployments/sepolia.json` 示例：

```json
{
  "contractName": "TraceAnchor",
  "network": "sepolia",
  "chainId": 11155111,
  "contractAddress": "0x...",
  "deployer": "0x...",
  "txHash": "0x..."
}
```

## 6. 后端联调完整步骤（NestJS）

1. 进入合约目录并安装依赖：`cd backend/src/modules/trace/contracts && npm install`。
2. 配置合约部署环境变量：复制 `.env.example` 为 `.env` 并填入 RPC/私钥。
3. 编译合约：`npm run compile`。
4. 部署合约：`npm run deploy:sepolia`。
5. 获取部署地址：查看控制台输出或 `deployments/sepolia.json` 中的 `contractAddress`。
6. 将网络与地址写入后端 `backend/.env`：
   ```env
   TRACE_ANCHOR_ENABLED=true
   TRACE_ANCHOR_PROVIDER=evm
   TRACE_CHAIN_PROVIDER=evm
   TRACE_CHAIN_NETWORK=sepolia
   EVM_RPC_URL=<同部署RPC>
   EVM_PRIVATE_KEY=<后端签名私钥>
   EVM_CHAIN_ID=11155111
   EVM_CHAIN_NAME=sepolia
   EVM_CONTRACT_ADDRESS=0x<部署地址>
   ```
7. 启动后端：`cd backend && npm run start:dev`。
8. 触发一次 trace 存证（建议用“未存在的 traceCode”触发自动生成并锚定）：
   - 先确认产品 ID 存在（例如 `productId=1`）。
   - 构造 traceCode：`P1-EVMPOC-20260421A`。
   - 调用：`GET /api/trace/P1-EVMPOC-20260421A/verify`（携带 `Authorization: Bearer <token>`）。
9. 检查数据库 `trace_records` 是否回写以下字段：
   - Prisma 字段：`txId`（列名 `tx_id`）
   - Prisma 字段：`anchorStatus`（列名 `anchor_status`）
   - Prisma 字段：`chainProvider`（列名 `chain_provider`）
   - Prisma 字段：`chainNetwork`（列名 `chain_network`）
   - Prisma 字段：`anchoredAt`（列名 `anchored_at`）
10. 再次调用 `GET /api/trace/:code/verify`，确认响应中包含 `txId` 和 `anchorStatus`。

## 7. 测试网使用说明

- Sepolia 部署和调用都需要测试币（Sepolia ETH）。
- 可通过 faucet 领取测试币（常见提供方：Alchemy、Infura、Chainlink 社区 faucet）。
- 交易提交后可在测试网浏览器（如 Sepolia Etherscan）按 `tx hash` 查询状态与日志。
- 本项目后端只需保存并返回 `tx hash`，不需要钱包 UI 或前端签名交互。

## 8. 后端对接最小信息

### 8.1 ABI 放置位置

- 推荐使用：`backend/src/modules/trace/contracts/TraceAnchor.json`
- 该文件由部署脚本自动更新为 `{ contractName, abi }` 结构。

### 8.2 合约地址读取

- 推荐从后端环境变量读取：`EVM_CONTRACT_ADDRESS`。
- 网络信息读取：`EVM_RPC_URL`、`EVM_CHAIN_ID`、`EVM_CHAIN_NAME`。

### 8.3 NestJS Service 最小示例

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

@Injectable()
export class TraceAnchorChainService {
  private readonly contract: Contract;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.getOrThrow<string>('trace.evm.rpcUrl');
    const privateKey = this.configService.getOrThrow<string>('trace.evm.privateKey');
    const chainId = Number(this.configService.getOrThrow<string>('trace.evm.chainId'));
    const contractAddress =
      this.configService.getOrThrow<string>('trace.evm.contractAddress');

    const abiPath = join(
      process.cwd(),
      'src/modules/trace/contracts/TraceAnchor.json',
    );
    const abi = JSON.parse(readFileSync(abiPath, 'utf8')).abi;

    const provider = new JsonRpcProvider(rpcUrl, chainId);
    const signer = new Wallet(privateKey, provider);
    this.contract = new Contract(contractAddress, abi, signer);
  }

  async anchorTrace(traceCode: string, proofHash: string) {
    const tx = await this.contract.anchorTrace(traceCode, proofHash);
    const receipt = await tx.wait();

    return {
      txId: tx.hash,
      anchorStatus: receipt?.status === 1 ? 'success' : 'failed',
    };
  }
}
```

> 说明：完整后端编排请继续使用现有 `trace` 模块服务层；此示例仅展示最小合约调用方式。
