/**
 * Global service configuration.
 *
 * dev:
 * - devtools simulator uses localhost (127.0.0.1)
 * - real device uses LAN URL and can be overridden from storage
 */

const ENV_MAP = {
  dev: 'http://127.0.0.1:8080',
  test: 'https://test-api.example.com',
  prod: 'https://api.example.com'
}

const DEV_BASE_URL_STORAGE_KEY = 'devBaseUrl'
// Real-device default must be reachable from phone. Keep simulator on ENV_MAP.dev.
const DEFAULT_LAN_BASE_URL = 'http://192.168.1.103:8080'
const LEGACY_LAN_BASE_URLS = [
  'http://33323s3q04.vicp.fun:18080',
  'http://33323s3q04.vicp.fun:29805'
]
const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1']
const CURRENT_ENV = 'dev'

function _normalizeBaseUrl(url) {
  const value = String(url || '').trim()
  if (!value) return ''
  return value.replace(/\/+$/, '')
}

function _isLoopbackBaseUrl(url) {
  const normalized = _normalizeBaseUrl(url)
  if (!normalized) return false
  const withoutProtocol = normalized.replace(/^https?:\/\//i, '')
  const hostPort = withoutProtocol.split('/')[0] || ''
  const host = (hostPort.split(':')[0] || '').toLowerCase()
  return LOOPBACK_HOSTS.includes(host)
}

function _isDevtoolsRuntime() {
  try {
    if (typeof wx.getDeviceInfo === 'function') {
      const info = wx.getDeviceInfo()
      return !!info && info.platform === 'devtools'
    }

    // Fallback for old base library versions.
    if (typeof wx.getSystemInfoSync === 'function') {
      const legacy = wx.getSystemInfoSync()
      return !!legacy && legacy.platform === 'devtools'
    }

    return false
  } catch (e) {
    return false
  }
}

function _readStorage(key) {
  try {
    return wx.getStorageSync(key)
  } catch (e) {
    return ''
  }
}

function _writeStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
    return true
  } catch (e) {
    return false
  }
}

function _removeStorage(key) {
  try {
    wx.removeStorageSync(key)
    return true
  } catch (e) {
    return false
  }
}

function getDevLanBaseUrl() {
  const fromStorage = _normalizeBaseUrl(_readStorage(DEV_BASE_URL_STORAGE_KEY))
  if (!fromStorage) return DEFAULT_LAN_BASE_URL
  if (LEGACY_LAN_BASE_URLS.includes(fromStorage)) {
    _removeStorage(DEV_BASE_URL_STORAGE_KEY)
    return DEFAULT_LAN_BASE_URL
  }
  if (!/^https?:\/\//i.test(fromStorage)) return DEFAULT_LAN_BASE_URL
  if (_isLoopbackBaseUrl(fromStorage)) return DEFAULT_LAN_BASE_URL
  return fromStorage
}

function setDevLanBaseUrl(url) {
  const normalized = _normalizeBaseUrl(url)
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('Backend URL must start with http:// or https://')
  }
  if (_isLoopbackBaseUrl(normalized)) {
    throw new Error('Real-device backend URL cannot be localhost/127.0.0.1')
  }
  if (!_writeStorage(DEV_BASE_URL_STORAGE_KEY, normalized)) {
    throw new Error('Failed to save backend URL')
  }
  return normalized
}

function clearDevLanBaseUrl() {
  _removeStorage(DEV_BASE_URL_STORAGE_KEY)
}

function resolveBaseUrl(env) {
  if (env !== 'dev') return _normalizeBaseUrl(ENV_MAP[env] || ENV_MAP.test)
  return _isDevtoolsRuntime()
    ? _normalizeBaseUrl(ENV_MAP.dev)
    : getDevLanBaseUrl()
}

function resolveBaseUrlByPath(urlPath, apiBaseUrl, aiBaseUrl, chainBaseUrl) {
  const path = String(urlPath || '')
  const baseUrl = resolveBaseUrl(CURRENT_ENV)
  if (path.startsWith('/ai/')) return _normalizeBaseUrl(aiBaseUrl) || baseUrl
  if (path.startsWith('/chain/')) return _normalizeBaseUrl(chainBaseUrl) || baseUrl
  if (path.startsWith('/api/')) return _normalizeBaseUrl(apiBaseUrl) || baseUrl
  return baseUrl
}

const config = {
  ENV: CURRENT_ENV,
  DEV_BASE_URL_STORAGE_KEY,
  DEFAULT_LAN_BASE_URL,

  // Keep this static property for compatibility with existing code.
  BASE_URL: resolveBaseUrl(CURRENT_ENV),
  API_BASE_URL: '',
  AI_BASE_URL: '',
  CHAIN_BASE_URL: '',

  getBaseUrl() {
    return resolveBaseUrl(CURRENT_ENV)
  },

  resolveBaseUrlByPath(urlPath) {
    return resolveBaseUrlByPath(
      urlPath,
      this.API_BASE_URL,
      this.AI_BASE_URL,
      this.CHAIN_BASE_URL
    )
  },

  getDevLanBaseUrl,
  setDevLanBaseUrl,
  clearDevLanBaseUrl,

  USE_MOCK: false,
  MOCK_FALLBACK: true,
  MOCK_DELAY: 600,

  TIMEOUT: 15000,
  USE_BEARER: true,
  SHOW_ERROR_TOAST: true,
  DEBUG: true
}

module.exports = config
