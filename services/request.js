const config = require('./config')

// ─── 内部工具 ───────────────────────────────────────

function _getAuth() {
  const token = wx.getStorageSync('token') || ''
  if (!token) return ''
  return config.USE_BEARER ? 'Bearer ' + token : token
}

function _kick401() {
  wx.removeStorageSync('token')
  wx.switchTab({ url: '/pages/mine/index' })
}

function _toast(msg) {
  wx.showToast({ title: msg || '请求失败', icon: 'none', duration: 2000 })
}

function _log(tag, info) {
  if (config.DEBUG) console.log('[' + tag + ']', info)
}

function _normalizeUrlPath(url) {
  if (!url) return '/'
  return String(url).startsWith('/') ? String(url) : '/' + String(url)
}

function _resolveBaseUrlByPath(urlPath) {
  if (urlPath.startsWith('/ai/')) return config.AI_BASE_URL || config.BASE_URL
  if (urlPath.startsWith('/chain/')) return config.CHAIN_BASE_URL || config.BASE_URL
  if (urlPath.startsWith('/api/')) return config.API_BASE_URL || config.BASE_URL
  return config.BASE_URL
}

function _cleanRequestData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const cleaned = {}
  Object.keys(data).forEach((key) => {
    const value = data[key]
    if (value !== undefined && value !== null) cleaned[key] = value
  })
  return cleaned
}

/**
 * 统一处理业务错误：弹 toast + reject
 * 单个请求可传 showError:false 跳过 toast
 */
function _rejectWithToast(msg, showError) {
  const shown = showError !== false && config.SHOW_ERROR_TOAST
  if (shown) _toast(msg)
  const err = new Error(msg)
  err._toasted = shown
  return err
}

// ─── wx.request 统一封装 ────────────────────────────
//
// 支持所有 HTTP 方法：GET / POST / PUT / DELETE
// options: { url, method, data, header, showError }
//   showError  默认 true，设为 false 可关闭本次请求的自动 toast

const request = (options) => {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    showError
  } = options

  const urlPath = _normalizeUrlPath(url)
  const fullUrl = _resolveBaseUrlByPath(urlPath) + urlPath
  const cleanedData = _cleanRequestData(data)

  _log('REQ', method + ' ' + urlPath + ' ' + JSON.stringify(cleanedData))

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method,
      data: cleanedData,
      timeout: config.TIMEOUT,
      header: {
        'Content-Type': 'application/json',
        'Authorization': _getAuth(),
        ...header
      },
      success(res) {
        _log('RES', res.statusCode + ' ' + urlPath + ' ' +
          JSON.stringify(res.data).slice(0, 300))

        if (res.statusCode === 401) {
          _kick401()
          reject(_rejectWithToast('登录已过期，请重新登录', showError))
          return
        }

        if (res.statusCode >= 200 && res.statusCode < 300 &&
            res.data && res.data.code === 0) {
          resolve(res.data.data)
          return
        }

        // code !== 0 或 HTTP 非 2xx → 统一走错误
        const msg = (res.data && res.data.message) ||
          '请求失败(' + res.statusCode + ')'
        reject(_rejectWithToast(msg, showError))
      },
      fail(err) {
        _log('ERR', urlPath + ' ' + err.errMsg)
        reject(_rejectWithToast(err.errMsg || '网络异常', showError))
      }
    })
  })
}

// ─── HTTP 快捷方法 ──────────────────────────────────

request.get = (url, data, opts) =>
  request({ url, method: 'GET', data, ...opts })

request.post = (url, data, opts) =>
  request({ url, method: 'POST', data, ...opts })

request.put = (url, data, opts) =>
  request({ url, method: 'PUT', data, ...opts })

request.del = (url, data, opts) =>
  request({ url, method: 'DELETE', data, ...opts })

// ─── wx.uploadFile 统一封装 ─────────────────────────
//
// options: { url, filePath, name, formData, showError }

const uploadFile = (options) => {
  const {
    url,
    filePath,
    name = 'file',
    formData = {},
    showError
  } = options

  const urlPath = _normalizeUrlPath(url)
  const fullUrl = _resolveBaseUrlByPath(urlPath) + urlPath

  _log('UPLOAD', urlPath + ' name=' + name)

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: fullUrl,
      filePath,
      name,
      formData,
      timeout: config.TIMEOUT,
      header: { 'Authorization': _getAuth() },
      success(res) {
        _log('UPLOAD-RES', res.statusCode + ' ' + urlPath)

        if (res.statusCode === 401) {
          _kick401()
          reject(_rejectWithToast('登录已过期，请重新登录', showError))
          return
        }

        let parsed
        try { parsed = JSON.parse(res.data) } catch (e) {
          reject(_rejectWithToast('响应解析失败', showError))
          return
        }

        if (parsed.code === 0) {
          resolve(parsed.data)
        } else {
          reject(_rejectWithToast(parsed.message || '上传失败', showError))
        }
      },
      fail(err) {
        _log('UPLOAD-ERR', urlPath + ' ' + err.errMsg)
        reject(_rejectWithToast(err.errMsg || '上传失败', showError))
      }
    })
  })
}

// ─── mock 工具 ──────────────────────────────────────

const mockResolve = (data, delay) => {
  return new Promise(resolve => {
    setTimeout(() => resolve(data), delay || config.MOCK_DELAY)
  })
}

/**
 * 真实接口优先，失败时可降级 mock
 * @param {Function} realFn  返回真实请求 Promise 的函数（惰性调用）
 * @param {Function} mockFn  返回 mock 数据 Promise 的函数
 */
const tryReal = (realFn, mockFn) => {
  if (config.USE_MOCK) return mockFn()
  return realFn().catch(err => {
    if (config.MOCK_FALLBACK) {
      console.warn('[mock降级]', err.message || err)
      return mockFn()
    }
    throw err
  })
}

module.exports = { request, uploadFile, mockResolve, tryReal }
