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

### 1. 安装依赖

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
