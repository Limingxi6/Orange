/**
 * 全局服务配置
 *
 * ── mock 模式 ──────────────────────────────────────
 * USE_MOCK = true           → 全部走 mock，不发真实请求
 * USE_MOCK = false 且 MOCK_FALLBACK = true  → 优先真实接口，失败自动降级 mock
 * USE_MOCK = false 且 MOCK_FALLBACK = false → 纯真实接口，失败直接报错
 *
 * ── 环境切换 ──────────────────────────────────────
 * 修改 CURRENT_ENV 即可切换 dev / test / prod
 */

const ENV_MAP = {
  // 本机调试（开发者工具）
  dev: 'http://localhost:8080',
  // 测试环境后端
  test: 'https://test-api.example.com',
  // 生产环境后端
  prod: 'https://api.example.com'
}

// 真机调试请改成你电脑的局域网地址（与手机同一 Wi-Fi）
// 例如：http://192.168.31.120:8080
const LAN_BASE_URL = 'http://192.168.31.120:8080'

function isDevtoolsRuntime() {
  try {
    const info = wx.getSystemInfoSync()
    return info && info.platform === 'devtools'
  } catch (e) {
    return false
  }
}

function resolveBaseUrl(env) {
  if (env !== 'dev') return ENV_MAP[env]
  return isDevtoolsRuntime() ? ENV_MAP.dev : LAN_BASE_URL
}

const CURRENT_ENV = 'dev'

const config = {
  ENV: CURRENT_ENV,
  // 统一后端服务地址（/api、/ai、/chain 默认都走该域名）
  BASE_URL: resolveBaseUrl(CURRENT_ENV),
  // 如需分域名可单独配置（未配置时会自动回落到 BASE_URL）
  API_BASE_URL: '',
  AI_BASE_URL: '',
  CHAIN_BASE_URL: '',

  // mock
  USE_MOCK: false,
  MOCK_FALLBACK: true,
  MOCK_DELAY: 600,

  // 请求
  TIMEOUT: 15000,
  USE_BEARER: true,

  // code !== 0 时自动弹 wx.showToast（单个请求可用 showError:false 覆盖）
  SHOW_ERROR_TOAST: true,

  // 控制台打印请求 / 响应日志
  DEBUG: true
}

module.exports = config
