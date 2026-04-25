const { request, mockResolve, tryReal } = require('./request')

const MOCK_QR_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=='

const MOCK_PRODUCTS = [
  {
    id: 1,
    batchId: 1001,
    batchName: '2026春季纽荷尔脐橙A区',
    variety: '纽荷尔脐橙',
    grade: '一级果',
    status: 'listed',
    price: '6.8~8.2元/斤',
    qrcodeGenerated: true,
    traceCode: 'P1-B1001-KS8Q1A',
    qrcodeImage: MOCK_QR_BASE64,
    qrcodeUrl: '/pages/trace-view/index?code=P1-B1001-KS8Q1A',
  },
  {
    id: 2,
    batchId: 1002,
    batchName: '2026春季纽荷尔脐橙B区',
    variety: '纽荷尔脐橙',
    grade: '二级果',
    status: 'pending',
    price: '4.5~5.8元/斤',
    qrcodeGenerated: false,
    traceCode: '',
    qrcodeImage: '',
    qrcodeUrl: '',
  },
]

function _isDataImage(value) {
  return /^data:image\//i.test(String(value || ''))
}

function _isLikelyImageUrl(value) {
  const url = String(value || '').trim()
  if (!url) return false
  if (_isDataImage(url) || url.startsWith('wxfile://')) return true
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?.*)?$/i.test(url)
}

function _normalizeStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'listed') return '已上架'
  if (normalized === 'pending') return '待上架'
  return status || '--'
}

function _normalizeProductItem(item) {
  const row = item && typeof item === 'object' ? item : {}
  const qrcodeImage = row.qrcodeBase64 || row.qrcodeImage || (_isDataImage(row.qrcodeUrl) ? row.qrcodeUrl : '')
  const qrcodeUrl = row.qrCodeUrl || row.qrcodeUrl || ''
  const hasQrcodeImage = Boolean(qrcodeImage || _isLikelyImageUrl(qrcodeUrl))

  return {
    ...row,
    id: row.id,
    batchId: row.batchId,
    batchName: row.batchName || row.batchNo || row.productName || '--',
    variety: row.variety || '--',
    grade: row.grade || '--',
    status: _normalizeStatus(row.status),
    price: row.price || row.retailPrice || '--',
    traceCode: row.traceCode || row.code || '',
    qrcodeImage,
    qrcodeUrl,
    hasQrcodeImage,
    qrcodeType: row.qrcodeType || 'normal',
    qrcodeFallback: Boolean(row.qrcodeFallback),
    qrcodeFallbackReason: row.qrcodeFallbackReason || '',
    qrcodeGenerated: Boolean(row.qrcodeGenerated || qrcodeImage || qrcodeUrl),
  }
}

function _normalizeListPayload(raw) {
  if (Array.isArray(raw)) {
    return raw.map(_normalizeProductItem)
  }

  const data = raw && typeof raw === 'object' ? raw : {}
  if (Array.isArray(data.list)) {
    return data.list.map(_normalizeProductItem)
  }

  return []
}

function _cleanGeneratePayload(payload) {
  const input = payload && typeof payload === 'object' ? payload : {}
  const cleaned = {}

  if (typeof input.traceCode === 'string' && input.traceCode.trim()) {
    cleaned.traceCode = input.traceCode.trim()
  }
  if (typeof input.accessUrl === 'string' && input.accessUrl.trim()) {
    cleaned.accessUrl = input.accessUrl.trim()
  }

  return cleaned
}

function _normalizeGenerateResult(raw, id, payload) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const qrcodeImage = data.qrcodeBase64 || data.qrcodeImage || (_isDataImage(data.qrcodeUrl) ? data.qrcodeUrl : '')
  const qrcodeUrl = data.qrCodeUrl || data.qrcodeUrl || payload.accessUrl || ''
  const hasQrcodeImage = Boolean(qrcodeImage || _isLikelyImageUrl(qrcodeUrl))

  return {
    ...data,
    id: data.id || id,
    batchId: data.batchId,
    traceCode: data.traceCode || data.code || payload.traceCode || '',
    qrcodeUrl,
    qrcodeImage,
    hasQrcodeImage,
    qrcodeType: data.qrcodeType || 'normal',
    qrcodeFallback: Boolean(data.qrcodeFallback),
    qrcodeFallbackReason: data.qrcodeFallbackReason || '',
    qrcodeGenerated: Boolean(qrcodeImage || data.qrCodeUrl || data.qrcodeUrl),
  }
}

const productService = {
  getList(params = {}) {
    return tryReal(
      () =>
        request({ url: '/api/products', method: 'GET', data: params }).then((res) =>
          _normalizeListPayload(res),
        ),
      () => mockResolve(MOCK_PRODUCTS.map(_normalizeProductItem)),
    )
  },

  generateQrcode(productId, payload = {}) {
    const cleanedPayload = _cleanGeneratePayload(payload)

    return tryReal(
      () =>
        request({
          url: `/api/products/${productId}/qrcode`,
          method: 'POST',
          data: cleanedPayload,
          timeout: 45000,
        }).then((res) => _normalizeGenerateResult(res, productId, cleanedPayload)),
      () =>
        mockResolve(
          _normalizeGenerateResult(
            {
              id: productId,
              traceCode: cleanedPayload.traceCode || `P${productId}-MOCK-${Date.now().toString(36).toUpperCase()}`,
              qrcodeBase64: MOCK_QR_BASE64,
              qrcodeUrl: cleanedPayload.accessUrl || '',
            },
            productId,
            cleanedPayload,
          ),
        ),
    )
  },
}

module.exports = productService
