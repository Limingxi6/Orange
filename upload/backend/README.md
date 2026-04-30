# 橘源通后端服务

> 微信小程序"橘源通"的 NestJS 后端服务

## 技术栈

- **框架**: NestJS 10.x
- **ORM**: Prisma 5.x
- **数据库**: MySQL 8.x
- **缓存**: Redis 7.x
- **认证**: JWT + Passport
- **文档**: Swagger (OpenAPI 3.0)
- **校验**: class-validator + class-transformer

## 快速开始

### 0.（推荐）先准备 AI Python 虚拟环境

> 说明：`backend` 本身是 Node.js 服务，不依赖 Python 虚拟环境；但如果你要联调病害识别/果实分级等 AI 能力，建议先完成此步骤。

```bash
# 在项目根目录执行
cd ai
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# 安装 AI 依赖
pip install -r requirements.txt
```

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库、Redis、JWT 等
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run prisma:generate

# 执行数据库迁移
npm run prisma:migrate
```

### 4. 启动服务

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

### 5. 访问接口文档

开发环境下访问 http://localhost:8080/docs 查看 Swagger 文档

## 项目结构

```
backend/
├── prisma/
│   └── schema.prisma          # 数据库模型定义
├── src/
│   ├── common/                # 公共模块
│   │   ├── decorators/        # 自定义装饰器
│   │   ├── dto/               # 公共 DTO
│   │   ├── filters/           # 异常过滤器
│   │   ├── guards/            # 守卫
│   │   ├── interceptors/      # 拦截器
│   │   ├── interfaces/        # 接口定义
│   │   └── strategies/        # Passport 策略
│   ├── modules/               # 业务模块
│   │   ├── auth/              # 认证模块
│   │   ├── batch/             # 批次管理
│   │   ├── log/               # 农事日志
│   │   ├── disease/           # 病害识别
│   │   ├── risk/              # 风险预警
│   │   ├── price/             # 定价服务
│   │   ├── product/           # 产品管理
│   │   ├── trace/             # 溯源查询
│   │   ├── weather/           # 天气服务
│   │   └── upload/            # 文件上传
│   ├── prisma/                # Prisma 模块
│   ├── redis/                 # Redis 模块
│   ├── app.module.ts          # 根模块
│   └── main.ts                # 入口文件
├── .env                       # 环境变量
└── package.json
```

## API 规范

### 统一响应格式

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

- `code`: 状态码，0 表示成功，非 0 表示错误
- `message`: 消息描述
- `data`: 响应数据

### 认证方式

除登录、发送验证码等公开接口外，所有接口都需要在请求头中携带 JWT Token：

```
Authorization: Bearer <token>
```

### 接口前缀

- 常规接口: `/api/xxx`
- AI 接口: `/ai/xxx`
- 区块链接口: `/chain/xxx`

## 开发指南

### 创建新模块

```bash
# 使用 NestJS CLI 创建模块
nest g module modules/xxx
nest g controller modules/xxx
nest g service modules/xxx
```

### 数据库操作

```bash
# 查看数据库
npm run prisma:studio

# 修改 schema 后重新生成
npm run prisma:generate

# 创建迁移
npm run prisma:migrate
```

## 环境变量说明

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| PORT | 服务端口 | 8080 | 否 |
| NODE_ENV | 运行环境 (development/test/production) | development | 否 |
| DATABASE_URL | MySQL 连接字符串 | - | **是** |
| REDIS_HOST | Redis 主机 | localhost | 否 |
| REDIS_PORT | Redis 端口 | 6379 | 否 |
| REDIS_PASSWORD | Redis 密码 | - | 否 |
| JWT_SECRET | JWT 密钥（至少 16 位） | - | **是** |
| JWT_EXPIRES_IN | JWT 过期时间 | 7d | 否 |
| UPLOAD_MODE | 上传模式 (local/minio/cos) | local | 否 |
| LOCAL_UPLOAD_DIR | 本地上传目录 | ./uploads | 否 |
| MINIO_ENDPOINT | MinIO 端点 | - | UPLOAD_MODE=minio 时必填 |
| MINIO_PORT | MinIO 端口 | 9000 | 否 |
| MINIO_ACCESS_KEY | MinIO Access Key | - | UPLOAD_MODE=minio 时必填 |
| MINIO_SECRET_KEY | MinIO Secret Key | - | UPLOAD_MODE=minio 时必填 |
| MINIO_BUCKET | MinIO Bucket | orange | 否 |
| MINIO_USE_SSL | MinIO 是否使用 SSL | false | 否 |

## 配置使用示例

在任意 Service 或 Controller 中注入 `ConfigService` 即可读取配置：

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExampleService {
  constructor(private configService: ConfigService) {}

  example() {
    // 读取单个配置
    const port = this.configService.get<number>('app.port');
    const jwtSecret = this.configService.get<string>('jwt.secret');
    
    // 读取嵌套配置
    const redisHost = this.configService.get<string>('redis.host');
    const uploadMode = this.configService.get<string>('upload.mode');
    
    // 带默认值
    const timeout = this.configService.get<number>('app.timeout', 30000);
  }
}
```

### 配置路径速查表

| 配置路径 | 类型 | 说明 |
|----------|------|------|
| `app.port` | number | 服务端口 |
| `app.env` | string | 运行环境 |
| `app.isDev` | boolean | 是否开发环境 |
| `app.isProd` | boolean | 是否生产环境 |
| `database.url` | string | 数据库连接字符串 |
| `redis.host` | string | Redis 主机 |
| `redis.port` | number | Redis 端口 |
| `redis.password` | string | Redis 密码 |
| `jwt.secret` | string | JWT 密钥 |
| `jwt.expiresIn` | string | JWT 过期时间 |
| `upload.mode` | string | 上传模式 |
| `upload.maxFileSize` | number | 最大文件大小 |
| `upload.local.dir` | string | 本地上传目录 |
| `upload.minio.endpoint` | string | MinIO 端点 |
| `upload.minio.bucket` | string | MinIO Bucket |
| `sms.codeLength` | number | 验证码长度 |
| `sms.expireSeconds` | number | 验证码过期时间 |
| `sms.dailyLimit` | number | 每日发送上限 |

## License

MIT

---

## AI MVP Update (2026-04-13)

### New/Aligned Endpoints

- `POST /ai/disease/predict`
  - Multipart upload (`file`) or `imageUrl`
  - Compatible fields: `batchId` / `batch_id`
  - Returns frontend-friendly fields: `label`, `advice`, `needManualReview`, and legacy-compatible fields.
- `POST /ai/fruit/grade`
  - Multipart upload (`file`) or `imageUrl`
  - Compatible fields: `batchId` / `batch_id`, `packageType` / `packaging`
  - Returns grading + pricing payload used by mini-program fruit-grade page.
- `GET /api/risk/:batchId`
  - Path-param version of risk assessment.
  - Existing `GET /api/risk/assessment?batchId=...` remains available.

### Traditional Model + LLM Collaboration

- Disease recognition / fruit grading / risk scoring:
  - Rule-based/traditional deterministic logic first (MVP).
- LLM usage:
  - Explanation polishing, risk reason/suggestion polishing, traceability narrative generation.
  - If LLM is not configured, system falls back to deterministic templates.

### New Environment Variables

```env
# Disease AI inference service
DISEASE_AI_BASE_URL=
DISEASE_AI_PREDICT_PATH=/predict
DISEASE_AI_TIMEOUT_MS=15000
DISEASE_AI_API_KEY=

# LLM
LLM_ENABLED=false
LLM_BASE_URL=
LLM_CHAT_PATH=/v1/chat/completions
LLM_API_KEY=
LLM_MODEL=deepseek-chat
LLM_TIMEOUT_MS=15000
LLM_TEMPERATURE=0.2
LLM_MAX_TOKENS=512
```

### Quick API Examples

```bash
# 1) AI disease predict
curl -X POST "http://localhost:8080/ai/disease/predict" \
  -H "Authorization: Bearer <token>" \
  -F "file=@leaf.jpg" \
  -F "batchId=1"

# 2) AI fruit grade
curl -X POST "http://localhost:8080/ai/fruit/grade" \
  -H "Authorization: Bearer <token>" \
  -F "file=@fruit.jpg" \
  -F "channel=电商" \
  -F "packageType=礼盒" \
  -F "region=湖北宜昌"

# 3) Risk assessment by path param
curl -X GET "http://localhost:8080/api/risk/1" \
  -H "Authorization: Bearer <token>"
```

### Tests Added (Skeleton)

- `src/modules/ai/ai-narrative.service.spec.ts`
- `src/modules/price/price-engine.spec.ts`

Run:

```bash
npm run build
npm test -- --runInBand
```

### Training/Inference Skeleton

- `ai/disease/train.py`
- `ai/disease/infer_service.py`
- `ai/fruit/train.py`
- `ai/fruit/infer.py`
