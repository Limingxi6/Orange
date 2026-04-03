# 橘源通 —— 项目现状与待办总结

> 更新时间：2026-03-18

---

## 一、已完成的工作

### 1.1 基础架构层

| 工作内容 | 涉及文件 |
|---------|----------|
| 统一请求封装（`wx.request` + `wx.uploadFile`） | `services/request.js` |
| 多环境配置（dev / test / prod）+ mock / real 双模式切换 | `services/config.js` |
| 自动 `Authorization: Bearer <token>` 注入 | `request.js` → `_getAuth()` |
| 统一 `{ code, message, data }` 响应解包 | `request.js` |
| 401 自动踢出登录 + 请求超时 + DEBUG 日志 | `request.js` |
| 错误 toast 去重机制（`_toasted` 标记，避免 request 层与页面重复弹窗） | `request.js` + 各页面 |
| HTTP 快捷方法 `request.get` / `.post` / `.put` / `.del` | `request.js` |

### 1.2 Service 层

| 工作内容 | 涉及文件 |
|---------|----------|
| `user.js` 重命名为 `auth.js`，统一认证模块 | `services/auth.js` |
| 全部 service 方法对齐真实接口文档（URL、Method、参数、返回字段） | 全部 8 个 service 文件 |
| 方法重命名以贴合 API 语义：`predictDisease`→`predict`、`getLogTypes`→`getTypes`、`getTraceInfo`→`getInfo`、`getHistory`→`getRecords` | disease / log / trace |
| `generateQrcode` 从 `trace.js` 迁移至 `product.js` | trace.js / product.js |
| 全部 service 方法添加 JSDoc 文档注释 | 全部 service 文件 |
| 每个方法保留 `tryReal(realFn, mockFn)` 双路径（真实优先，mock 降级） | 全部 service 文件 |

### 1.3 页面层（6 个关键页面完成联调接入）

| 页面 | 做了什么 |
|------|---------|
| `pages/login/index` | 手机号 + 验证码登录流程、token / userInfo 存入 storage、开发环境一键登录按钮 |
| `pages/mine/index` | 从 storage 恢复登录态、异步刷新 profile、退出登录清除 token + userInfo |
| `pages/batch-list/index` | 服务端关键词搜索 + 350ms 防抖、loading / error / empty 状态覆盖 |
| `pages/batch-detail/index` | 并行加载批次详情 + 日志、noBatchId 防御、loading / error 状态覆盖 |
| `pages/farming-log/index` | 并行加载日志类型 + 日志列表、客户端筛选、noBatchId 防御、下拉刷新 |
| `pages/disease-recognize/index` | `wx.uploadFile` 上传 AI 识别、识别结果一键保存为日志、补注册 `van-empty`、`image_url` 使用服务端返回地址 |

### 1.4 全局

| 工作内容 | 涉及文件 |
|---------|----------|
| `app.js` 启动时从 storage 恢复 userInfo，异步校验 token 有效性 | `app.js` |
| 全部引用路径从 `services/user` 更新为 `services/auth` | 7+ 文件 |
| API 真实接口文档整理（25 个接口） | `docs/api-interface-list.md` |
| 联调自检 + 3 个 bug 修复（van-empty 注册、image_url 修正、双重 toast 消除） | 多文件 |

---

## 二、当前项目状态

### 2.1 项目结构

```
Orange/
├── app.js                  # 小程序入口，启动时恢复登录态
├── app.json                # 页面注册 + tabBar 配置
├── app.wxss                # 全局样式
├── assets/icons/           # tabBar 图标
├── components/             # 自定义组件
│   ├── batch-card/         # 批次卡片（未使用）
│   ├── ec-canvas/          # echarts 画布（risk-warning 使用）
│   ├── log-timeline/       # 日志时间线（farming-log 使用）
│   ├── price-panel/        # 价格面板（fruit-grade 使用）
│   ├── risk-card/          # 风险卡片（未使用）
│   └── trace-block/        # 溯源区块（未使用）
├── docs/
│   ├── api-interface-list.md   # 25 个真实接口清单
│   └── project-status.md      # 本文档
├── pages/                  # 11 个页面
│   ├── home/               # 首页 ✅
│   ├── batch-list/         # 批次列表 ✅
│   ├── batch-detail/       # 批次详情 ✅
│   ├── disease-recognize/  # 病害识别 ✅
│   ├── farming-log/        # 农事日志 ✅
│   ├── risk-warning/       # 风险预警 ✅
│   ├── fruit-grade/        # 果实分级 ✅
│   ├── product-qrcode/     # 产品二维码 ✅
│   ├── trace-view/         # 溯源查看 ✅
│   ├── mine/               # 我的 ✅
│   └── login/              # 登录 ✅
└── services/               # 接口服务层
    ├── config.js           # 全局配置（环境 / mock 开关 / 超时）
    ├── request.js          # 统一请求封装
    ├── auth.js             # 认证：login / sendCode / logout / getProfile
    ├── batch.js            # 批次：getList / getDetail / create / updateStage
    ├── log.js              # 日志：getListByBatch / create / getTypes
    ├── disease.js          # 病害：predict / getRecords
    ├── risk.js             # 风险：getSummary / getAssessment / getHistory
    ├── price.js            # 定价：gradeAndPrice / getBaseline / getSuggestion
    ├── product.js          # 产品：getList / generateQrcode
    ├── trace.js            # 溯源：getInfo / verifyChain
    └── weather.js          # 天气：getWeather / getForecast
```

> ✅ 表示已完成联调专项优化（loading / error / empty 状态、字段适配、防御处理）

### 2.2 页面 × 接口接入状态

| 页面 | 联调状态 | 调用的 service 方法 |
|------|---------|-------------------|
| login | ✅ 已联调 | `auth.login` / `auth.sendCode` |
| mine | ✅ 已联调 | `auth.getProfile` / `auth.logout` |
| batch-list | ✅ 已联调 | `batch.getList` |
| batch-detail | ✅ 已联调 | `batch.getDetail` / `log.getListByBatch` |
| farming-log | ✅ 已联调 | `log.getListByBatch` / `log.getTypes` |
| disease-recognize | ✅ 已联调 | `disease.predict` / `log.create` |
| home | ✅ 已联调 | `weather.getWeather` / `risk.getSummary` / `batch.getList` |
| risk-warning | ✅ 已联调 | `weather.getWeather` / `weather.getForecast` / `risk.getAssessment` / `risk.getHistory` |
| fruit-grade | ✅ 已联调 | `price.gradeAndPrice` / `price.getBaseline` |
| product-qrcode | ✅ 已联调 | `product.getList` / `product.generateQrcode` |
| trace-view | ✅ 已联调 | `trace.getInfo` / `trace.verifyChain` |

### 2.3 TabBar 配置

| Tab | 页面 | 文字 |
|-----|------|------|
| 1 | pages/home/index | 首页 |
| 2 | pages/batch-list/index | 批次 |
| 3 | pages/mine/index | 我的 |

---

## 三、待完成事项

### 3.1 剩余 5 个页面的联调优化

全部 11 个页面的联调优化已完成。

| 页面 | 需要做的事 |
|------|-----------|
| ~~**home（首页）**~~ | ✅ 已完成：三接口并行 + 部分失败处理、loading / error / empty 状态、字段适配 |
| ~~**risk-warning（风险预警）**~~ | ✅ 已完成：四接口并行 + 部分失败处理、echarts 安全降级、loading / error / empty 状态 |
| ~~**fruit-grade（果实分级）**~~ | ✅ 已完成：uploadFile 上传确认、双重 toast 修复、defectRatio 兼容、gradeFailed 状态、baseline 预留接入 |
| ~~**product-qrcode（产品二维码）**~~ | ✅ 已完成：loading / error / empty 状态、qrcodeUrl 回写 + previewImage、生成防重复、双重 toast 修复 |
| ~~**trace-view（溯源查看）**~~ | ✅ 已完成：嵌套字段空值防御、noBatchId 防御、verifyChain failed 处理、loading / error / empty 状态、双重 toast 修复 |

### 3.2 未实现的业务功能

| 功能 | 现状 | 说明 |
|------|------|------|
| 新建批次 | `batch-list` 页按钮显示"功能开发中" | 需要新建表单页面（品种、地块、面积、种植日期等） |
| 手动新增农事日志 | `farming-log` 页按钮显示"功能开发中" | 需要新建表单页面（选类型、填内容、上传图片） |
| 更新批次阶段 | service 层已有 `batch.updateStage`，页面未调用 | 需在批次详情页添加操作入口 |
| 病害识别历史 | service 层已有 `disease.getRecords`，页面未展示 | 可在识别页或新建单独页面展示历史记录 |
| 价格基准线查询 | service 层已有 `price.getBaseline`，未接入页面 | 可在果实分级页补充展示 |
| 定价建议查询 | service 层已有 `price.getSuggestion`，未接入页面 | 可在果实分级页补充展示 |

### 3.3 未使用的自定义组件

| 组件 | 路径 | 建议 |
|------|------|------|
| batch-card | `components/batch-card/` | 可用于 batch-list 页面卡片展示，或确认不需要后删除 |
| risk-card | `components/risk-card/` | 可用于 risk-warning 页面，或确认不需要后删除 |
| trace-block | `components/trace-block/` | 可用于 trace-view 页面，或确认不需要后删除 |

---

## 四、部署前需手动配置的内容

| 配置项 | 当前值 | 你需要做的 |
|--------|--------|-----------|
| 后端地址 | `services/config.js` → `ENV_MAP.dev` = `http://localhost:8080` | 改为你的实际后端 IP:端口 |
| 环境切换 | `CURRENT_ENV = 'dev'` | 联调阶段保持 `dev`，上线前改为 `prod` |
| Mock 开关 | `USE_MOCK = false` | 当前已关闭 mock，真实接口优先 |
| Mock 降级 | `MOCK_FALLBACK = true` | 联调初期保持 `true`（接口失败自动降级 mock），接口稳定后改 `false` |
| 测试账号 | `13800000000` / `123456` | 需在后端创建此测试账号，或修改前端 `auth.js` 中的 `TEST_ACCOUNT` |
| Token 格式 | `Bearer <token>` | 确认后端校验 `Authorization: Bearer xxx` 格式；如不需要 Bearer 前缀，改 `config.USE_BEARER = false` |
| 合法域名 | — | 正式联调时需在微信公众平台 → 开发设置中添加后端域名为合法请求域名 |
| TabBar 图标 | `assets/icons/` | 确认 6 个图标文件（home / home-active / batch / batch-active / mine / mine-active）存在且正确 |

---

## 五、后端需实现的接口清单

详见 [`docs/api-interface-list.md`](./api-interface-list.md)，去重后共 **25 个独立接口**：

- 2 个 AI 推理接口（`multipart/form-data` 文件上传）
- 4 个认证接口（登录 / 登出 / 发验证码 / 获取用户信息）
- 19 个常规 CRUD / 查询接口

所有接口统一返回格式：

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

---

## 六、推荐的下一步行动顺序

1. **配置后端地址** → `config.js` 中 `ENV_MAP.dev` 改为实际地址
2. **后端实现前 6 个关键接口** → login / batches / logs / disease predict
3. **微信开发者工具联调验证** → 一键登录 → 批次列表 → 批次详情 → 农事日志 → 病害识别
4. **联调优化剩余 5 个页面** → home / risk-warning / fruit-grade / product-qrcode / trace-view
5. **实现新建批次、手动记日志等表单功能**
6. **关闭 mock 降级** → `MOCK_FALLBACK = false`
7. **切换生产环境** → `CURRENT_ENV = 'prod'`，配置合法域名，提交审核
