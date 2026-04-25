const { request, mockResolve, tryReal } = require('./request')

const MOCK_LOGS = [
  {
    id: 1, time: '2026-03-16 09:30', type: '识别',
    content: '拍照识别叶片，AI 判定疑似柑橘溃疡病（置信度 91%，中风险），已标记待复核',
    operator: '李大橘', images: [],
    detail: '对 A 区第 3 排脐橙进行叶片拍照识别，系统返回疑似柑橘溃疡病，置信度 91%。已自动写入批次日志，建议巡园复核。'
  },
  {
    id: 2, time: '2026-03-15 09:00', type: '施肥',
    content: '春季追肥，施用复合肥 15kg/亩',
    operator: '李大橘', images: [],
    detail: '对 A 区纽荷尔脐橙进行春季追肥，使用 15-15-15 复合肥，每亩 15kg，撒施后浅翻覆土。'
  },
  {
    id: 3, time: '2026-03-10 14:00', type: '喷药',
    content: '波尔多液预防性喷施，全园覆盖',
    operator: '李大橘', images: [],
    detail: '配制 0.5% 波尔多液 200L，对全园进行预防性喷施，重点覆盖春梢嫩叶和老叶背面。天气预报未来 3 天有雨，提前喷施。'
  },
  {
    id: 4, time: '2026-03-07 08:30', type: '浇水',
    content: '灌溉一次，土壤湿度恢复至 65%',
    operator: '李大橘', images: [],
    detail: '近期持续干燥，A 区土壤湿度降至 40% 以下。本次灌溉约 2 小时，灌后检测土壤湿度恢复至 65%。'
  },
  {
    id: 5, time: '2026-02-28 10:00', type: '修剪',
    content: '春季整形修剪，去除病枝弱枝',
    operator: '李大橘', images: [],
    detail: '对 A 区全部 120 棵脐橙进行整形修剪，主要去除交叉枝、下垂枝、病枝和细弱枝。每棵约修剪 15-20 个枝条，修剪废枝已集中清理。'
  },
  {
    id: 6, time: '2026-02-20 16:00', type: '施肥',
    content: '基肥施入，有机肥 20kg/亩',
    operator: '李大橘', images: [],
    detail: '春季基肥，每亩施入发酵有机肥 20kg + 过磷酸钙 2kg，环状沟施，沟深约 20cm，施后回填覆土。'
  },
  {
    id: 7, time: '2025-12-20 11:00', type: '采摘',
    content: 'B 区纽荷尔脐橙采摘完成，总计 1800 斤',
    operator: '李大橘', images: [],
    detail: 'B 区 2025 秋批次纽荷尔脐橙全部采摘完成，共采收 1800 斤。果实整体品质较好，少数有轻微日灼。采后已入库待分级。'
  },
  {
    id: 8, time: '2025-12-21 14:00', type: '分级',
    content: 'B 区脐橙分级完成：一级果 60%、二级果 30%、三级果 10%',
    operator: '李大橘', images: [],
    detail: '对 B 区 1800 斤脐橙进行拍照分级。一级果 1080 斤（色泽均匀、无缺陷），二级果 540 斤（轻微色斑），三级果 180 斤（日灼或偏小）。'
  },
  {
    id: 9, time: '2025-12-25 09:00', type: '销售',
    content: 'B 区一级果已上架电商渠道，建议零售价 7.5 元/斤',
    operator: '李大橘', images: [],
    detail: '一级果 1080 斤已生成溯源二维码并上架电商渠道。建议零售价 7.5 元/斤（基准价 6.0 × 品质系数 1.1 × 渠道系数 1.05 × 追溯溢价 1.08）。'
  }
]

const MOCK_LOG_TYPES = [
  { label: '全部', value: 'all', icon: 'apps-o' },
  { label: '识别', value: '识别', icon: 'scan' },
  { label: '浇水', value: '浇水', icon: 'drop' },
  { label: '施肥', value: '施肥', icon: 'flower-o' },
  { label: '喷药', value: '喷药', icon: 'shield-o' },
  { label: '修剪', value: '修剪', icon: 'scissors' },
  { label: '采摘', value: '采摘', icon: 'shopping-cart-o' },
  { label: '分级', value: '分级', icon: 'gem-o' },
  { label: '销售', value: '销售', icon: 'cash-back-record' }
]

const LOG_TYPE_LABEL_MAP = {
  inspection: '识别',
  irrigation: '浇水',
  fertilization: '施肥',
  pesticide: '喷药',
  pruning: '修剪',
  harvest: '采摘',
  grading: '分级',
  sales: '销售',
  识别: '识别',
  浇水: '浇水',
  施肥: '施肥',
  喷药: '喷药',
  修剪: '修剪',
  采摘: '采摘',
  分级: '分级',
  销售: '销售'
}

const READABLE_KEYS = ['description', 'content', 'remark', 'advice', 'reason', 'detail', 'message', 'text']
const META_ONLY_KEYS = [
  'source',
  'operator',
  'createdBy',
  'updatedBy',
  'id',
  'type',
  'operatorId',
  'createdAt',
  'updatedAt'
]
const SOURCE_LABEL_MAP = {
  manual: '手动记录',
  disease_recognize: '病害识别',
  system: '系统生成'
}

function _normalizeText(value) {
  if (value === null || value === undefined) return ''
  const text = String(value).replace(/\r\n/g, '\n').trim()
  return text.replace(/[ \t]+/g, ' ')
}

function _safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch (err) {
    return ''
  }
}

function _pickFirstText(values = []) {
  for (const value of values) {
    const text = _normalizeText(value)
    if (text) return text
  }
  return ''
}

function _isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function _isMetaOnlyObject(obj) {
  if (!_isPlainObject(obj)) return false
  const keys = Object.keys(obj)
  if (!keys.length) return true
  return keys.every((key) => META_ONLY_KEYS.includes(key))
}

function _extractReadableDetail(detail, seen = new Set()) {
  if (detail === null || detail === undefined) return ''

  if (typeof detail === 'string' || typeof detail === 'number' || typeof detail === 'boolean') {
    return _normalizeText(detail)
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => _extractReadableDetail(item, seen))
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (!_isPlainObject(detail)) {
    return _normalizeText(detail)
  }

  if (seen.has(detail)) return ''
  seen.add(detail)

  const preferred = _pickFirstText([detail.description, detail.content, detail.remark])
  if (preferred) return preferred

  if (_isMetaOnlyObject(detail)) return ''

  for (const key of READABLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(detail, key)) {
      const text = _extractReadableDetail(detail[key], seen)
      if (text) return text
    }
  }

  return _normalizeText(_safeStringify(detail))
}

function _normalizeTime(value) {
  const text = _normalizeText(value)
  if (!text) return ''
  if (text.includes('T')) {
    const compact = text.slice(0, 19).replace('T', ' ')
    return _normalizeText(compact)
  }
  return text
}

function _normalizeImages(raw) {
  let list = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string' && raw.trim()) {
    list = raw.includes(',') ? raw.split(',') : [raw]
  }

  return list
    .map((item) => _normalizeText(item))
    .filter((url) => {
      if (!url) return false
      if (/^https?:\/\/example\.com\//i.test(url)) return false
      return true
    })
}

function _normalizeLogItem(item = {}) {
  const type = item.type || item.logType || item.log_type || ''
  const detailObject = _isPlainObject(item.detail) ? item.detail : null

  const displayTime = _normalizeTime(item.time || item.date || item.createdAt || item.operationDate || '')
  const displayContent = _pickFirstText([item.description, item.content])

  const preferredDetail = _pickFirstText([
    item.description,
    item.content,
    detailObject && detailObject.description,
    detailObject && detailObject.content,
    detailObject && detailObject.remark
  ])
  const fallbackDetail = preferredDetail ? '' : _extractReadableDetail(item.detail)
  const displayDetail = preferredDetail || fallbackDetail || '暂无详细描述'

  const sourceCode = _pickFirstText([item.source, detailObject && detailObject.source, 'manual'])
  const displaySource = SOURCE_LABEL_MAP[sourceCode] || sourceCode || '手动记录'
  const displayImages = _normalizeImages(item.images || item.image_url)

  return {
    ...item,
    time: displayTime,
    content: displayContent || '暂无日志摘要',
    detail: displayDetail,
    images: displayImages,
    displayTime,
    displayContent: displayContent || '暂无日志摘要',
    displayDetail,
    displaySource,
    displaySourceCode: sourceCode || 'manual',
    displayImages,
    typeText: LOG_TYPE_LABEL_MAP[type] || type,
    type
  }
}

function _normalizeBatchId(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function _normalizeLogList(raw) {
  const rows = Array.isArray(raw) ? raw : []
  return rows.map(_normalizeLogItem)
}

function _extractBatchId(item = {}) {
  return _normalizeBatchId(item.batchId ?? item.batch_id)
}

function _filterMockLogs(list, params = {}) {
  let rows = Array.isArray(list) ? list.slice() : []
  const queryType = _normalizeText(params.type)
  const queryBatchId = _normalizeBatchId(params.batchId ?? params.batch_id)

  if (queryType && queryType !== 'all') {
    rows = rows.filter((item) => String(item.type || '') === queryType)
  }

  if (queryBatchId) {
    rows = rows.filter((item) => {
      const itemBatchId = _extractBatchId(item)
      if (!itemBatchId) return true
      return itemBatchId === queryBatchId
    })
  }

  return rows
}

function _toDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const text = String(value).trim()
  if (!text) return null

  const normalizedText = text.includes('T') ? text : text.replace(/-/g, '/')
  let date = new Date(normalizedText)
  if (Number.isNaN(date.getTime())) {
    date = new Date(text)
  }
  return Number.isNaN(date.getTime()) ? null : date
}

function _getLogDate(item = {}) {
  return _toDate(item.operationDate || item.createdAt || item.displayTime || item.time || item.date)
}

function _isSameDate(dateA, dateB) {
  if (!(dateA instanceof Date) || !(dateB instanceof Date)) return false
  return (
    dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth()
    && dateA.getDate() === dateB.getDate()
  )
}

function _filterTodayLogs(logs, baseDate = new Date()) {
  const list = Array.isArray(logs) ? logs : []
  return list.filter((item) => _isSameDate(_getLogDate(item), baseDate))
}

function _sortLogsByTimeDesc(logs) {
  const list = Array.isArray(logs) ? logs.slice() : []
  list.sort((a, b) => {
    const diff = (_getLogDate(b)?.getTime() || 0) - (_getLogDate(a)?.getTime() || 0)
    if (diff) return diff
    return Number(b.id || 0) - Number(a.id || 0)
  })
  return list
}

function _dedupeLogs(logs) {
  const list = Array.isArray(logs) ? logs : []
  const seen = new Set()
  const deduped = []

  list.forEach((item) => {
    const batchId = _extractBatchId(item) || 'x'
    const fallbackKey = [
      batchId,
      item.type || '',
      item.time || item.displayTime || '',
      item.content || item.displayContent || '',
    ].join('|')
    const key =
      item && item.id !== undefined && item.id !== null
        ? `id:${item.id}`
        : `f:${fallbackKey}`

    if (seen.has(key)) return
    seen.add(key)
    deduped.push(item)
  })

  return deduped
}

function _uniqueBatchIds(batchIds) {
  const list = Array.isArray(batchIds) ? batchIds : []
  const seen = new Set()
  const result = []

  list.forEach((batchId) => {
    const normalized = _normalizeBatchId(batchId)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    result.push(normalized)
  })

  return result
}

const logService = {
  /**
   * 获取日志列表（兼容全量与按批次查询）
   * GET /api/logs
   * @param {{ batchId?: number|string, type?: string }} params
   * @returns {Array}
   */
  getList(params = {}) {
    const query = { ...(params || {}) }
    if (query.batch_id && !query.batchId) query.batchId = query.batch_id
    delete query.batch_id
    if (query.type === 'all') delete query.type

    return tryReal(
      () =>
        request({
          url: '/api/logs',
          method: 'GET',
          data: query,
          showError: false,
        }).then(_normalizeLogList),
      () => mockResolve(_filterMockLogs(MOCK_LOGS, query).map(_normalizeLogItem)),
    )
  },
  /**
   * 获取批次日志列表
   * GET /api/logs?batchId=:batchId
   * @param {string|number} batchId
   * @param {{ type? }} params - type 枚举: 识别/浇水/施肥/喷药/修剪/采摘/分级/销售
   * @returns {Array<{ id, time, type, content, operator, images, detail }>}
   */
  getListByBatch(batchId, params = {}) {
    const normalizedBatchId = _normalizeBatchId(batchId)
    if (!normalizedBatchId) {
      return Promise.reject(new Error('Please select a valid batch first'))
    }
    return this.getList({ ...(params || {}), batchId: normalizedBatchId })
  },

  /**
   * 获取今天的操作记录
   * 优先调用 GET /api/logs 全量；失败时按 batchIds 聚合兜底
   * @param {{ batchIds?: Array<number|string>, limit?: number }} options
   * @returns {Promise<Array>}
   */
  async getTodayRecords(options = {}) {
    const opts = options && typeof options === 'object' ? options : {}
    const batchIds = _uniqueBatchIds(opts.batchIds)
    const allowAll = Boolean(opts.allowAll)
    const limit = Number(opts.limit)
    const hasLimit = Number.isFinite(limit) && limit > 0

    let logs = []
    const shouldFetchByBatch = batchIds.length > 0

    if (shouldFetchByBatch) {
      const settled = await Promise.allSettled(batchIds.map((batchId) => this.getListByBatch(batchId)))
      const merged = []
      let firstError = null

      settled.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (Array.isArray(result.value)) merged.push(...result.value)
          return
        }
        if (!firstError) firstError = result.reason
      })

      if (merged.length > 0) {
        logs = merged
      } else if (firstError) {
        throw firstError
      }
    } else {
      logs = allowAll ? await this.getList() : []
    }

    const sortedToday = _sortLogsByTimeDesc(_dedupeLogs(_filterTodayLogs(logs)))
    if (hasLimit) return sortedToday.slice(0, Math.floor(limit))
    return sortedToday
  },

  /**
   * 新建日志
   * POST /api/logs
   * @param {{ batch_id, log_type, description, image_url, source }} data
   *   source: 'disease_recognize' | 'manual'
   * @returns {{ id }}
   */
  create(data) {
    const payload = { ...(data || {}) }
    const normalizedBatchId = _normalizeBatchId(payload.batchId ?? payload.batch_id)
    if (!normalizedBatchId) {
      return Promise.reject(new Error('请先选择关联批次后再保存日志'))
    }

    payload.batchId = normalizedBatchId
    delete payload.batch_id

    return tryReal(
      () => request({ url: '/api/logs', method: 'POST', data: payload }),
      () => mockResolve({ id: Date.now() })
    )
  },

  /**
   * 获取日志类型列表
   * GET /api/logs/types
   * @returns {Array<{ label, value, icon }>}
   */
  getTypes() {
    return tryReal(
      () => request({ url: '/api/logs/types', method: 'GET' }),
      () => mockResolve(MOCK_LOG_TYPES)
    )
  }
}

module.exports = logService
