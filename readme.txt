初始化本地后端数据库（本机 MySQL）
cd E:\Orange\backend
# 首次才需要
copy .env.example .env
# 确认 .env 里 DATABASE_URL 是 mysql://root:@127.0.0.1:3306/orange_db

mysql -h127.0.0.1 -P3306 -uroot -e "CREATE DATABASE IF NOT EXISTS orange_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm install
npx prisma migrate deploy
npm run prisma:seed
启动 AI 服务（本地）
cd E:\Orange\ai
pip install -r requirements.txt
uvicorn service.app:app --host 0.0.0.0 --port 9001
启动后端（本地）
cd E:\Orange\backend
npm run start:dev
本机验收
curl -i -X POST http://127.0.0.1:8080/api/auth/login -H "Content-Type: application/json" -d "{\"phone\":\"13800000000\",\"password\":\"123456\"}"
返回 code:0 就是通了。

