const { request, mockResolve, tryReal } = require('./request')
const {
  localizeDiseaseLabel,
  normalizeSeverityCode,
  toSeverityText
} = require('./disease-localization')

const MOCK_TRACE = {
  traceCode: 'P1-B1001-KS8Q1A',
  batchInfo: {
    name: '2026春季纽荷尔脐橙A区',
    variety: '纽荷尔脐橙',
    plotName: '东区3号地块',
    plotLocation: '湖北省宜昌市',
    area: '5亩',
    plantDate: '2026-01-15',
    stage: '果实膨大期',
    status: '种植中',
  },
  gradeInfo: {
    grade: '一级果',
    retailMinPrice: 6.8,
    retailMaxPrice: 8.2,
    wholesaleMinPrice: 4.2,
    wholesaleMaxPrice: 5.5,
    colorScore: 92,
    sizeScore: 88,
    maturityScore: 90,
    defectRatio: 3,
  },
  timeline: [
    { time: '2026-03-16 09:30', type: '病害识别', content: 'AI识别叶片，疑似溃疡病，已标记待复核。' },
    { time: '2026-03-15 09:00', type: '施肥', content: '春季追肥，复合肥 15kg/亩。' },
    { time: '2026-03-10 14:00', type: '喷药', content: '波尔多液预防性喷施，全园覆盖。' },
  ],
  diseaseRecords: [
    { date: '2026-03-16', label: '疑似柑橘溃疡病', confidence: 91, severity: '中', status: 'review', needManualReview: true },
    { date: '2026-03-08', label: '健康', confidence: 95, severity: '低', status: 'normal', needManualReview: false },
  ],
  chainAnchors: [
    {
      eventType: '溯源快照哈希',
      time: '2026-03-16 09:35',
      proofType: 'hash',
      proofHash: 'd7c3dd4af06d9dcf40b2b2b8bfa19ac0f897',
      anchorStatus: 'not_anchored',
      chainProvider: 'evm',
      chainNetwork: 'sepolia',
      anchoredAt: null,
      txId: null,
      status: 'verified',
    },
  ],
  overallChainStatus: 'verified',
  verified: true,
  message: '当前溯源快照与已存证摘要一致。',
  proofType: 'hash',
  proofHash: 'd7c3dd4af06d9dcf40b2b2b8bfa19ac0f897',
  anchorStatus: 'not_anchored',
  txId: null,
  chainProvider: 'evm',
  chainNetwork: 'sepolia',
  anchoredAt: null,
}

const TRACE_QUERY_KEYS = ['code', 'tracecode']
const TRACE_COMPAT_QUERY_KEYS = ['batchid']
const TRACE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{3,127}$/

function _asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function _toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function _normalizeConfidence(value) {
  const n = _toFiniteNumber(value)
  if (n === null) return null
  const normalized = n >= 0 && n <= 1 ? n : n / 100
  const bounded = Math.max(0, Math.min(1, normalized))
  if (bounded >= 0.8 && bounded <= 0.97) return Math.round(bounded * 100)
  if (bounded > 0.97) return 97
  return Math.round((0.8 + bounded * 0.17) * 100)
}

function _formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function _formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function _resolveVerified(data) {
  if (data && typeof data.verified === 'boolean') {
    return data.verified
  }

  const status = String(
    (data && (data.status || data.overallChainStatus || data.verifyStatus)) || '',
  ).toLowerCase()

  if (status === 'verified' || status === 'success') {
    return true
  }
  if (status === 'failed') {
    return false
  }
  return undefined
}

function _normalizeVerifyStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'verified' || normalized === 'success') {
    return 'verified'
  }
  if (normalized === 'failed') {
    return 'failed'
  }
  return 'pending'
}

function _normalizeAnchorStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'pending') return 'pending'
  if (normalized === 'success') return 'success'
  if (normalized === 'failed') return 'failed'
  if (normalized === 'not_anchored') return 'not_anchored'
  return ''
}

function _defaultVerifyMessage(status) {
  if (status === 'verified') {
    return '当前溯源快照与已存证摘要一致。'
  }
  if (status === 'failed') {
    return '当前溯源快照与已存证摘要不一致。'
  }
  return '当前校验仍以本地哈希比对结果为准。'
}

function _normalizeAnchorVerifyStatus(anchorStatus, verifyStatus) {
  if (verifyStatus === 'verified') return 'verified'
  if (verifyStatus === 'failed') return 'failed'

  const normalized = String(anchorStatus || '').toLowerCase()
  if (normalized === 'verified' || normalized === 'success') return 'verified'
  if (normalized === 'failed') return 'failed'
  return 'pending'
}

function _parsePriceRange(value) {
  if (value === undefined || value === null || value === '') {
    return { min: null, max: null, text: '--' }
  }

  if (typeof value === 'number') {
    return { min: value, max: value, text: String(value) }
  }

  const text = String(value)
  const nums = text.match(/\d+(?:\.\d+)?/g) || []
  if (nums.length >= 2) {
    const min = Number(nums[0])
    const max = Number(nums[1])
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { min, max, text }
    }
  }

  if (nums.length === 1) {
    const only = Number(nums[0])
    if (Number.isFinite(only)) {
      return { min: only, max: only, text }
    }
  }

  return { min: null, max: null, text }
}

function _formatPriceRange(minValue, maxValue, fallbackText) {
  const min = _toFiniteNumber(minValue)
  const max = _toFiniteNumber(maxValue)

  if (min !== null && max !== null) {
    return `${min} - ${max}`
  }
  if (min !== null) {
    return `${min}`
  }
  if (max !== null) {
    return `${max}`
  }

  const text = String(fallbackText || '').trim()
  return text || '--'
}

function _normalizeGradeInfo(data) {
  const grade = _asObject(data.gradeInfo)
  const product = _asObject(data.productInfo)

  if (
    Object.keys(grade).length === 0 &&
    !product.grade &&
    !product.price &&
    product.retailMinPrice === undefined
  ) {
    return null
  }

  const retailRange = _parsePriceRange(grade.retailPrice || product.retailPrice || product.price)
  const wholesaleRange = _parsePriceRange(
    grade.wholesalePrice || product.wholesalePrice || product.price,
  )

  const retailMinPrice =
    _toFiniteNumber(grade.retailMinPrice) ?? _toFiniteNumber(product.retailMinPrice) ?? retailRange.min
  const retailMaxPrice =
    _toFiniteNumber(grade.retailMaxPrice) ?? _toFiniteNumber(product.retailMaxPrice) ?? retailRange.max
  const wholesaleMinPrice =
    _toFiniteNumber(grade.wholesaleMinPrice) ??
    _toFiniteNumber(product.wholesaleMinPrice) ??
    wholesaleRange.min
  const wholesaleMaxPrice =
    _toFiniteNumber(grade.wholesaleMaxPrice) ??
    _toFiniteNumber(product.wholesaleMaxPrice) ??
    wholesaleRange.max

  return {
    ...grade,
    grade: grade.grade || product.grade || '--',
    retailMinPrice,
    retailMaxPrice,
    wholesaleMinPrice,
    wholesaleMaxPrice,
    retailPrice: _formatPriceRange(retailMinPrice, retailMaxPrice, retailRange.text),
    wholesalePrice: _formatPriceRange(wholesaleMinPrice, wholesaleMaxPrice, wholesaleRange.text),
    colorScore: _toFiniteNumber(grade.colorScore),
    sizeScore: _toFiniteNumber(grade.sizeScore),
    maturityScore: _toFiniteNumber(grade.maturityScore),
    defectRatio: _toFiniteNumber(grade.defectRatio),
    riskWarning: grade.riskWarning || '',
    reason: grade.reason || '',
    factors: Array.isArray(grade.factors) ? grade.factors : [],
  }
}

function _localizeTimelineType(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const normalized = raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const localizedMap = {
    'production record': '生产记录',
    'production records': '生产记录',
    fertilization: '施肥',
    fertilizer: '施肥',
    spraying: '喷药',
    spray: '喷药',
    irrigation: '灌溉',
    watering: '浇水',
    pruning: '修剪',
    harvest: '采摘',
    packaging: '包装',
    transport: '运输',
    'disease recognition': '病害识别',
    'disease detection': '病害识别',
    'quality inspection': '质检',
  }

  if (localizedMap[normalized]) {
    return localizedMap[normalized]
  }

  if (normalized.includes('production') && normalized.includes('record')) {
    return '生产记录'
  }

  return raw
}

function _normalizeTimeline(data) {
  const timelineRaw = Array.isArray(data.timeline)
    ? data.timeline
    : Array.isArray(data.logTimeline)
      ? data.logTimeline
      : []

  return timelineRaw.map((item) => ({
    ...item,
    type: _localizeTimelineType(item.type || item.title || item.action) || '生产记录',
    content: item.content || item.summary || item.description || '--',
    time: item.time || _formatDateTime(item.operationDate || item.createdAt || item.date),
  }))
}

function _normalizeDiseaseRecords(data) {
  const diseaseRaw = Array.isArray(data.diseaseRecords)
    ? data.diseaseRecords
    : Array.isArray(data.inspections)
      ? data.inspections
      : []

  return diseaseRaw.map((item) => {
    const confidence = _normalizeConfidence(item.confidence)
    const needManualReview =
      typeof item.needManualReview === 'boolean'
        ? item.needManualReview
        : String(item.status || '').toLowerCase() === 'review'
    const severityCode = normalizeSeverityCode(item.severity || item.level)

    return {
      ...item,
      label: localizeDiseaseLabel(item.label || item.diseaseName || item.result || '--'),
      date: item.date || _formatDate(item.createdAt),
      confidence,
      needManualReview,
      status: item.status || (needManualReview ? 'review' : 'normal'),
      severity: toSeverityText(severityCode),
      severityCode,
    }
  })
}

function _buildProofMeta(data) {
  const proof = _asObject(data.proof || data.proofInfo)
  const anchor = _asObject(data.anchor || data.anchorInfo)

  const proofType =
    data.proofType || proof.proofType || proof.type || anchor.proofType || anchor.type || 'hash'
  const proofHash =
    data.proofHash ||
    data.chainHash ||
    proof.proofHash ||
    proof.hash ||
    anchor.proofHash ||
    anchor.hash ||
    ''
  const anchorStatus = _normalizeAnchorStatus(
    data.anchorStatus || anchor.anchorStatus || anchor.status || '',
  ) || 'not_anchored'
  const txId = data.txId || anchor.txId || anchor.transactionId || ''
  const chainProvider = data.chainProvider || anchor.chainProvider || anchor.provider || ''
  const chainNetwork = data.chainNetwork || anchor.chainNetwork || anchor.network || ''
  const anchoredAt = _formatDateTime(data.anchoredAt || anchor.anchoredAt || anchor.time)

  return {
    proofType,
    proofHash,
    anchorStatus,
    txId,
    chainProvider,
    chainNetwork,
    anchoredAt,
  }
}

function _normalizeAnchors(data, verifyStatus, proofMeta) {
  let chainAnchors = Array.isArray(data.chainAnchors)
    ? data.chainAnchors
    : Array.isArray(data.anchors)
      ? data.anchors
      : []

  if (chainAnchors.length === 0 && proofMeta.proofHash) {
    chainAnchors = [
      {
        eventType: '溯源快照哈希',
        time: _formatDateTime(data.createdAt),
        proofType: proofMeta.proofType,
        proofHash: proofMeta.proofHash,
        anchorStatus: proofMeta.anchorStatus,
        txId: proofMeta.txId,
        chainProvider: proofMeta.chainProvider,
        chainNetwork: proofMeta.chainNetwork,
        anchoredAt: proofMeta.anchoredAt,
        status: verifyStatus,
      },
    ]
  }

  return chainAnchors.map((item) => {
    const anchorStatus =
      _normalizeAnchorStatus(item.anchorStatus || item.status || proofMeta.anchorStatus) || 'not_anchored'

    return {
      ...item,
      eventType: item.eventType || item.title || '溯源快照哈希',
      time: item.time || _formatDateTime(item.createdAt || item.anchoredAt || data.createdAt),
      status: _normalizeAnchorVerifyStatus(item.status, verifyStatus),
      proofType: item.proofType || item.type || proofMeta.proofType,
      proofHash: item.proofHash || item.chainHash || item.hash || proofMeta.proofHash,
      anchorStatus,
      txId: item.txId || item.transactionId || proofMeta.txId,
      chainProvider: item.chainProvider || item.provider || proofMeta.chainProvider,
      chainNetwork: item.chainNetwork || item.network || proofMeta.chainNetwork,
      anchoredAt: _formatDateTime(item.anchoredAt || proofMeta.anchoredAt),
    }
  })
}

function _normalizeTraceSummary(value, fallbackSummary) {
  const base = value && typeof value === 'object' ? value : {}

  const summary =
    (typeof base.summary === 'string' && base.summary.trim())
    || (typeof fallbackSummary === 'string' && fallbackSummary.trim())
    || ''

  const actions = Array.isArray(base.actions)
    ? base.actions
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    : []

  return {
    title: (typeof base.title === 'string' && base.title.trim()) || '溯源说明建议',
    summary,
    actions,
    riskNote: (typeof base.riskNote === 'string' && base.riskNote.trim()) || '',
  }
}

function _normalizeTraceInfo(raw) {
  const data = _asObject(raw)
  const batch = _asObject(data.batchInfo)

  const verifiedValue = _resolveVerified(data)
  const explicitStatus =
    typeof data.overallChainStatus === 'string'
      ? data.overallChainStatus
      : typeof data.status === 'string'
        ? data.status
        : ''
  const overallChainStatus =
    typeof verifiedValue === 'boolean'
      ? verifiedValue
        ? 'verified'
        : 'failed'
      : _normalizeVerifyStatus(explicitStatus)

  const proofMeta = _buildProofMeta(data)
  const chainAnchors = _normalizeAnchors(data, overallChainStatus, proofMeta)
  const primaryAnchor = chainAnchors[0] || {}

  const verifiedCountRaw = _toFiniteNumber(data.verifiedCount)
  const totalAnchorCountRaw = _toFiniteNumber(data.totalAnchorCount)
  const verifiedCount =
    verifiedCountRaw === null
      ? chainAnchors.filter((item) => item && item.status === 'verified').length
      : verifiedCountRaw
  const totalAnchorCount = totalAnchorCountRaw === null ? chainAnchors.length : totalAnchorCountRaw

  const resolvedProofHash = proofMeta.proofHash || primaryAnchor.proofHash || ''
  const resolvedTxId = proofMeta.txId || primaryAnchor.txId || ''
  const resolvedChainProvider = proofMeta.chainProvider || primaryAnchor.chainProvider || ''
  const resolvedChainNetwork = proofMeta.chainNetwork || primaryAnchor.chainNetwork || ''
  const resolvedAnchoredAt = proofMeta.anchoredAt || primaryAnchor.anchoredAt || ''
  const traceSummary = _normalizeTraceSummary(
    data.traceSummary || data.buyerSummary,
    data.traceNarrative || data.summary || data.message || '',
  )

  return {
    ...data,
    traceCode: _resolveTraceCodeValue(data.traceCode, data.code, data.batchId),
    batchInfo: {
      ...batch,
      name: batch.name || batch.batchNo || '',
      plotName: batch.plotName || batch.orchardName || '',
      plotLocation: batch.plotLocation || batch.orchardName || '',
      plantDate: batch.plantDate || _formatDate(batch.plantingDate),
      stage: batch.stage || '--',
      status: batch.status || '--',
    },
    gradeInfo: _normalizeGradeInfo(data),
    timeline: _normalizeTimeline(data),
    diseaseRecords: _normalizeDiseaseRecords(data),
    chainAnchors,
    overallChainStatus,
    verifiedCount,
    totalAnchorCount,
    verified: typeof verifiedValue === 'boolean' ? verifiedValue : null,
    message: data.message || data.verifyMessage || _defaultVerifyMessage(overallChainStatus),
    proofType: proofMeta.proofType,
    proofHash: resolvedProofHash,
    anchorStatus: proofMeta.anchorStatus,
    txId: resolvedTxId,
    chainProvider: resolvedChainProvider,
    chainNetwork: resolvedChainNetwork,
    anchoredAt: resolvedAnchoredAt,
    chainHash: data.chainHash || resolvedProofHash,
    traceNarrative: traceSummary.summary || data.traceNarrative || '',
    traceSummary,
    buyerSummary: traceSummary,
  }
}

function _normalizeVerifyResult(raw) {
  const data = _asObject(raw)
  const verifiedValue = _resolveVerified(data)
  const statusByField = _normalizeVerifyStatus(data.status || data.overallChainStatus)
  const resolvedStatus =
    typeof verifiedValue === 'boolean'
      ? verifiedValue
        ? 'verified'
        : 'failed'
      : statusByField

  const proofMeta = _buildProofMeta(data)
  const verified =
    typeof verifiedValue === 'boolean'
      ? verifiedValue
      : resolvedStatus === 'verified'
        ? true
        : resolvedStatus === 'failed'
          ? false
          : null

  return {
    ...data,
    verified,
    status: resolvedStatus,
    message: data.message || _defaultVerifyMessage(resolvedStatus),
    proofType: proofMeta.proofType,
    proofHash: proofMeta.proofHash || null,
    anchorStatus: proofMeta.anchorStatus,
    txId: proofMeta.txId,
    chainProvider: proofMeta.chainProvider,
    chainNetwork: proofMeta.chainNetwork,
    anchoredAt: proofMeta.anchoredAt,
    chainHash: data.chainHash || proofMeta.proofHash || null,
    traceCode: _resolveTraceCodeValue(data.traceCode, data.code, data.batchId),
  }
}

function _safeDecode(value) {
  try {
    return decodeURIComponent(String(value === undefined || value === null ? '' : value))
  } catch (err) {
    return String(value === undefined || value === null ? '' : value)
  }
}

function _resolveTraceCodeValue(...values) {
  let fallback = ''
  for (let i = 0; i < values.length; i += 1) {
    const raw = _safeDecode(values[i]).trim()
    if (!raw) continue

    const normalized = _normalizeTraceCode(raw)
    if (normalized) return normalized
    if (!fallback) fallback = raw
  }
  return fallback
}

function _normalizeTraceCode(code) {
  const raw = _safeDecode(code).trim()
  if (!raw) return ''
  return TRACE_CODE_PATTERN.test(raw) ? raw : ''
}

function _extractCodeFromQuery(text) {
  const source = _safeDecode(text).trim()
  if (!source) return ''

  const queryText = source.includes('?') ? source.split('?').slice(1).join('?') : source
  const query = queryText.split('#')[0]
  if (!query) return ''

  const pairs = query.split('&')
  let compatibilityCode = ''

  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i]
    if (!pair || !pair.includes('=')) continue

    const separator = pair.indexOf('=')
    const key = _safeDecode(pair.slice(0, separator)).trim().toLowerCase()
    const value = _safeDecode(pair.slice(separator + 1)).trim()
    if (!value) continue

    if (TRACE_QUERY_KEYS.includes(key)) {
      const normalized = _normalizeTraceCode(value)
      if (normalized) return normalized
    }
    if (!compatibilityCode && TRACE_COMPAT_QUERY_KEYS.includes(key)) {
      const normalized = _normalizeTraceCode(value)
      if (normalized) compatibilityCode = normalized
    }
  }

  return compatibilityCode
}

function _extractTraceCode(rawInput) {
  const raw = _safeDecode(rawInput).trim()
  if (!raw) return ''

  const directCode = _normalizeTraceCode(raw)
  if (directCode) return directCode

  const fromQuery = _extractCodeFromQuery(raw)
  if (fromQuery) return fromQuery

  const apiMatch = raw.match(/\/api\/trace\/([^/?#]+)/i)
  if (apiMatch && apiMatch[1]) {
    const fromApi = _normalizeTraceCode(apiMatch[1])
    if (fromApi) return fromApi
  }

  const miniProgramPath = raw.match(/\/pages\/trace-view\/index(?:\?([^#]*))?/i)
  if (miniProgramPath && miniProgramPath[1]) {
    const fromMiniProgramPath = _extractCodeFromQuery(miniProgramPath[1])
    if (fromMiniProgramPath) return fromMiniProgramPath
  }

  const plainTail = _safeDecode(raw.split(/[/?#]/).filter(Boolean).pop() || '')
  const fromTail = _normalizeTraceCode(plainTail)
  if (fromTail) return fromTail

  return ''
}

function _hasTraceInput(options) {
  const opts = _asObject(options)
  return Boolean(
    String(opts.code || '').trim()
      || String(opts.traceCode || '').trim()
      || String(opts.scene || '').trim(),
  )
}

function _resolveTraceCodeFromOptions(options) {
  const opts = _asObject(options)

  const directCandidates = [opts.code, opts.traceCode]
  for (let i = 0; i < directCandidates.length; i += 1) {
    const fromDirect = _extractTraceCode(directCandidates[i])
    if (fromDirect) return fromDirect
  }

  if (opts.scene) {
    const fromScene = _extractTraceCode(opts.scene)
    if (fromScene) return fromScene
  }

  return ''
}

function _buildTraceViewPath(code) {
  const traceCode = _extractTraceCode(code)
  if (!traceCode) return ''
  return `/pages/trace-view/index?code=${encodeURIComponent(traceCode)}`
}

function _createInvalidCodeError() {
  const err = new Error('未识别到有效溯源码')
  err.code = 'INVALID_TRACE_CODE'
  return err
}

function _normalizeCode(code) {
  const normalizedCode = _extractTraceCode(code)
  if (!normalizedCode) return ''
  return encodeURIComponent(normalizedCode)
}

const traceService = {
  extractTraceCode(rawInput) {
    return _extractTraceCode(rawInput)
  },

  resolveTraceCodeFromOptions(options) {
    return _resolveTraceCodeFromOptions(options)
  },

  hasTraceInput(options) {
    return _hasTraceInput(options)
  },

  isValidTraceCode(code) {
    return Boolean(_normalizeTraceCode(code))
  },

  buildTraceViewPath(code) {
    return _buildTraceViewPath(code)
  },

  getInfo(code) {
    const normalizedCode = _normalizeCode(code)
    if (!normalizedCode) {
      return Promise.reject(_createInvalidCodeError())
    }
    return tryReal(
      () => request({ url: `/api/trace/${normalizedCode}`, method: 'GET' }).then(_normalizeTraceInfo),
      () => mockResolve(_normalizeTraceInfo(MOCK_TRACE)),
    )
  },

  verifyChain(code) {
    const normalizedCode = _normalizeCode(code)
    if (!normalizedCode) {
      return Promise.reject(_createInvalidCodeError())
    }
    return tryReal(
      () => request({ url: `/api/trace/${normalizedCode}/verify`, method: 'GET' }).then(_normalizeVerifyResult),
      () =>
        mockResolve(
          _normalizeVerifyResult({
            verified: true,
            status: 'verified',
            message: '当前溯源快照与已存证摘要一致。',
            proofType: 'hash',
            proofHash: MOCK_TRACE.proofHash,
            anchorStatus: 'not_anchored',
            txId: null,
            chainProvider: 'evm',
            chainNetwork: 'sepolia',
            anchoredAt: null,
          }),
          1000,
        ),
    )
  },
}

module.exports = traceService
