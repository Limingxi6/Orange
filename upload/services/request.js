const config = require('./config')

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
  wx.showToast({ title: msg || 'Request failed', icon: 'none', duration: 2000 })
}

function _log(tag, info) {
  if (config.DEBUG) console.log('[' + tag + ']', info)
}

function _normalizeUrlPath(url) {
  if (!url) return '/'
  return String(url).startsWith('/') ? String(url) : '/' + String(url)
}

function _resolveBaseUrlByPath(urlPath) {
  if (typeof config.resolveBaseUrlByPath === 'function') {
    return config.resolveBaseUrlByPath(urlPath)
  }

  const fallbackBaseUrl = typeof config.getBaseUrl === 'function'
    ? config.getBaseUrl()
    : config.BASE_URL

  if (urlPath.startsWith('/ai/')) return config.AI_BASE_URL || fallbackBaseUrl
  if (urlPath.startsWith('/chain/')) return config.CHAIN_BASE_URL || fallbackBaseUrl
  if (urlPath.startsWith('/api/')) return config.API_BASE_URL || fallbackBaseUrl
  return fallbackBaseUrl
}

function _isAuthFreePath(urlPath) {
  return urlPath === '/api/auth/login' || urlPath === '/api/auth/send-code'
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

function _normalizeNetworkErrorMessage(errMsg, fullUrl) {
  const raw = String(errMsg || '')
  const lowered = raw.toLowerCase()

  if (raw.includes('ERR_CONNECTION_REFUSED')) {
    return 'Backend unreachable. Confirm service is running and phone can access: ' + fullUrl
  }

  if (raw.includes('url not in domain list')) {
    return 'Domain is not in WeChat request domain whitelist'
  }

  if (lowered.includes('timeout') || lowered.includes('timed out')) {
    return 'Request timeout. Check phone/backend network connectivity: ' + fullUrl
  }

  if (lowered.includes('ssl') || lowered.includes('certificate')) {
    return 'HTTPS certificate verification failed'
  }

  if (raw.includes('ERR_NAME_NOT_RESOLVED') || lowered.includes('enotfound')) {
    return 'Domain resolution failed: ' + fullUrl
  }

  return raw || 'Network error'
}

function _rejectWithToast(msg, showError) {
  const shown = showError !== false && config.SHOW_ERROR_TOAST
  if (shown) _toast(msg)
  const err = new Error(msg)
  err._toasted = shown
  return err
}

const request = (options) => {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    showError,
    timeout,
  } = options

  const urlPath = _normalizeUrlPath(url)
  const fullUrl = _resolveBaseUrlByPath(urlPath) + urlPath
  const cleanedData = _cleanRequestData(data)
  const auth = _getAuth()

  if (!auth && !_isAuthFreePath(urlPath)) {
    _kick401()
    return Promise.reject(_rejectWithToast('Please login first', showError))
  }

  _log('REQ', method + ' ' + fullUrl + ' ' + JSON.stringify(cleanedData))

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method,
      data: cleanedData,
      timeout:
        typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0
          ? Math.floor(timeout)
          : config.TIMEOUT,
      header: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        ...header
      },
      success(res) {
        _log('RES', res.statusCode + ' ' + urlPath + ' ' + JSON.stringify(res.data).slice(0, 300))

        if (res.statusCode === 401) {
          _kick401()
          reject(_rejectWithToast('Session expired, please login again', showError))
          return
        }

        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          resolve(res.data.data)
          return
        }

        const msg = (res.data && res.data.message) || ('Request failed(' + res.statusCode + ')')
        reject(_rejectWithToast(msg, showError))
      },
      fail(err) {
        _log('ERR', fullUrl + ' ' + err.errMsg)
        reject(_rejectWithToast(_normalizeNetworkErrorMessage(err.errMsg, fullUrl), showError))
      }
    })
  })
}

request.get = (url, data, opts) =>
  request({ url, method: 'GET', data, ...opts })

request.post = (url, data, opts) =>
  request({ url, method: 'POST', data, ...opts })

request.put = (url, data, opts) =>
  request({ url, method: 'PUT', data, ...opts })

request.del = (url, data, opts) =>
  request({ url, method: 'DELETE', data, ...opts })

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
  const auth = _getAuth()
  const cleanedFormData = _cleanRequestData(formData)

  if (!auth && !_isAuthFreePath(urlPath)) {
    _kick401()
    return Promise.reject(_rejectWithToast('Please login first', showError))
  }

  _log('UPLOAD', fullUrl + ' name=' + name)

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: fullUrl,
      filePath,
      name,
      formData: cleanedFormData,
      timeout: config.TIMEOUT,
      header: { 'Authorization': auth },
      success(res) {
        _log('UPLOAD-RES', res.statusCode + ' ' + urlPath)

        if (res.statusCode === 401) {
          _kick401()
          reject(_rejectWithToast('Session expired, please login again', showError))
          return
        }

        let parsed
        try {
          parsed = JSON.parse(res.data)
        } catch (e) {
          reject(_rejectWithToast('Failed to parse response', showError))
          return
        }

        if (parsed.code === 0) {
          resolve(parsed.data)
        } else {
          reject(_rejectWithToast(parsed.message || 'Upload failed', showError))
        }
      },
      fail(err) {
        _log('UPLOAD-ERR', fullUrl + ' ' + err.errMsg)
        reject(_rejectWithToast(_normalizeNetworkErrorMessage(err.errMsg, fullUrl), showError))
      }
    })
  })
}

const mockResolve = (data, delay) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay || config.MOCK_DELAY)
  })
}

const tryReal = (realFn, mockFn) => {
  if (config.USE_MOCK) return mockFn()
  return realFn().catch((err) => {
    if (config.MOCK_FALLBACK) {
      console.warn('[mock fallback]', err.message || err)
      return mockFn()
    }
    throw err
  })
}

module.exports = { request, uploadFile, mockResolve, tryReal }
