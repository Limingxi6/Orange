# 橘源通使用说明


## 1. 运行前准备

- Node.js 18+（建议 LTS）
- Python 3.10+
- MySQL 8+
- Redis 6/7+
- 微信开发者工具（如需跑小程序）

## 2. 首次安装

在根目录分别安装后端和 AI 依赖：

```powershell
cd backend
npm install

cd ..\ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 3. 配置环境变量

### 3.1 后端

```powershell
cd backend
Copy-Item .env.example .env
```

至少确认这些项：

- `PORT=8080`
- `DATABASE_URL=mysql://...`（你的 MySQL 连接）
- `REDIS_HOST` / `REDIS_PORT`
- `JWT_SECRET`（改成你自己的）
- `DISEASE_AI_BASE_URL=http://127.0.0.1:9001`
- `DISEASE_AI_PREDICT_PATH=/ai/disease/predict`
- `AI_SERVICE_URL=http://127.0.0.1:9001`
- `FRUIT_PERCEPTION_PATH=/ai/fruit/perception`

### 3.2 AI 服务

```powershell
cd ..\ai
Copy-Item .env.example .env
```

本包已包含模型，默认可直接用：

- `DISEASE_MODEL_PATH=./models/disease_classifier.pt`
- `FRUIT_GRADE_MODEL_PATH=./models/fruit_grade/grade_model.joblib`

## 4. 数据库初始化（首次）

```powershell
cd ..\backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## 5. 启动顺序

建议开两个终端：

终端 A（AI 服务）：

```powershell
cd ai
.\.venv\Scripts\Activate.ps1
uvicorn service.app:app --host 0.0.0.0 --port 9001
```

终端 B（NestJS 后端）：

```powershell
cd backend
npm run start:dev
```

启动后访问：

- Swagger 文档：`http://127.0.0.1:8080/docs`
- AI 健康检查：`http://127.0.0.1:9001/health`

## 6. 小程序联调

1. 用微信开发者工具打开根目录。
2. 默认开发环境走 `services/config.js` 的 `http://127.0.0.1:8080`。
3. 真机调试时把 `DEFAULT_LAN_BASE_URL` 改为你电脑局域网地址（例如 `http://192.168.1.103:8080`），不要用 `127.0.0.1`。

## 7. 最小联调验收

后端起来后，至少验证：

- `POST /ai/disease/predict`
- `POST /ai/fruit/grade`
- `GET /api/risk/:batchId`
- `GET /api/trace/:code/verify`

统一返回格式应为：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

## 8. 常见问题

- 病害/果实接口回退到本地规则：先检查 `http://127.0.0.1:9001/health` 是否可达。
- 小程序真机请求失败：检查手机和电脑是否同一局域网，以及 `DEFAULT_LAN_BASE_URL` 是否正确。
- 登录或业务接口异常：优先检查 `backend/.env` 的数据库与 Redis 配置。
