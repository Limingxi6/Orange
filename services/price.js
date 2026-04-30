const { request, uploadFile, mockResolve, tryReal } = require('./request')

const MOCK_GRADE_RESULT = {
  variety: '纽荷尔脐橙',
  gradeCode: 'A',
  grade: '一级果',
  colorScore: 92,
  defectRatio: 0.03,
  sizeScore: 88,
  maturityScore: 90,
  retailMinPrice: 6.8,
  retailMaxPrice: 8.2,
  wholesaleMinPrice: 4.2,
  wholesaleMaxPrice: 5.5,
  reason: '色泽均匀、果径较大且成熟度较高，适合高品质渠道销售。',
  explanation: '色泽均匀、果径较大且成熟度较高，适合高品质渠道销售。',
  recommendation: {
    title: '分级与销售建议',
    summary: '当前等级建议优先标准化分拣后出货。',
    actions: ['先按等级分拣装箱', '出货前抽检复核'],
    riskNote: '建议结合当日行情复核最终报价',
  },
  riskWarning: '最终价格受地区供需和市场波动影响，以上建议仅供参考。',
  factors: {
    市场基准价: '6.0 元/斤',
    品质系数: '1.10',
    渠道系数: '1.05',
    包装系数: '1.00',
    追溯溢价: '1.08'
  },
  source: {
    engine: 'fallback-default',
    decision: 'rule-engine'
  },
  modelVersion: 'fallback-default-v1',
  requestId: 'mock-request-id'
}

const CHANNEL_COEFF = { 电商: 1.05, 批发: 0.85, 摆摊: 0.95 }
const PACKAGE_COEFF = { 简装: 1.0, 礼盒: 1.15 }

function normalizeBatchId(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return undefined
  return n
}

function normalizeActions(value) {
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 3)
  }
  if (typeof value !== 'string') return []
  return value
    .replace(/\r/g, '\n')
    .replace(/[；;]/g, '\n')
    .replace(/[。]\s*/g, '\n')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function normalizeRecommendation(value, fallbackSummary, fallbackRiskNote) {
  if (!value || typeof value !== 'object') {
    return {
      title: '分级与销售建议',
      summary: fallbackSummary || '',
      actions: [],
      riskNote: fallbackRiskNote || '',
    }
  }

  return {
    title: (typeof value.title === 'string' && value.title.trim()) || '分级与销售建议',
    summary: (typeof value.summary === 'string' && value.summary.trim()) || fallbackSummary || '',
    actions: normalizeActions(value.actions),
    riskNote: (typeof value.riskNote === 'string' && value.riskNote.trim()) || fallbackRiskNote || '',
  }
}

function normalizeGradeResult(data) {
  if (!data || typeof data !== 'object') return MOCK_GRADE_RESULT

  const toNum = (v, fallback = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }

  const gradeCode = data.gradeCode || (data.grade === '一级果' ? 'A' : data.grade === '二级果' ? 'B' : 'C')
  const explanation = data.explanation || data.reason || ''
  const riskWarning = data.riskWarning || '建议结合市场行情动态调整价格。'
  const recommendation = normalizeRecommendation(data.recommendation || data.aiSuggestion, explanation, riskWarning)

  return {
    ...data,
    variety: data.variety || '纽荷尔脐橙',
    gradeCode,
    grade: data.grade || data.gradeText || data.gradeCode || '二级果',
    colorScore: toNum(data.colorScore),
    defectRatio: toNum(data.defectRatio),
    sizeScore: toNum(data.sizeScore),
    maturityScore: toNum(data.maturityScore),
    retailMinPrice: toNum(data.retailMinPrice),
    retailMaxPrice: toNum(data.retailMaxPrice),
    wholesaleMinPrice: toNum(data.wholesaleMinPrice),
    wholesaleMaxPrice: toNum(data.wholesaleMaxPrice),
    reason: data.reason || explanation,
    explanation,
    recommendation,
    riskWarning,
    factors: data.factors || {},
    source: data.source || { engine: 'fallback-default', decision: 'rule-engine' },
    modelVersion: data.modelVersion || null,
    requestId: data.requestId || ''
  }
}

function normalizeBaseline(data, gradeCode) {
  if (!data || typeof data !== 'object') return null

  const toNum = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  const baselineMap = data.baselineMap && typeof data.baselineMap === 'object' ? data.baselineMap : {}
  const resolvedGradeCode = String(gradeCode || data.gradeCode || '').toUpperCase()
  const mappedPrice = resolvedGradeCode ? toNum(baselineMap[resolvedGradeCode]) : undefined
  const fallbackMapPrice = Object.keys(baselineMap)
    .map(key => toNum(baselineMap[key]))
    .find(value => value !== undefined)
  const basePrice = toNum(data.basePrice) ?? mappedPrice ?? fallbackMapPrice

  return {
    ...data,
    gradeCode: resolvedGradeCode || data.gradeCode || '',
    basePrice: basePrice ?? 0,
    unit: data.unit || '元/斤',
    updateTime: data.updateTime || ''
  }
}

const SOURCE_ENGINE_LABELS = {
  'python-ai': 'AI',
  'local-rule': '本地规则',
  'fallback-default': '默认兜底'
}

const SOURCE_DECISION_LABELS = {
  'rule-engine': '规则引擎',
  'trained-tabular-model': '训练表格模型',
  'local-rules': '本地规则'
}

const MODEL_VERSION_LABELS = {
  'fruit-perception-v1': '果实感知-v1',
  'local-perception-rule-v1': '本地感知规则-v1',
  'fallback-default-v1': '默认兜底-v1'
}

function localizeText(raw) {
  if (typeof raw !== 'string' || !raw) return raw
  return raw
    .replace(/python[- ]ai/gi, 'AI')
    .replace(/local-rules\+grade-model/gi, '本地规则+分级模型')
    .replace(/local-rules/gi, '本地规则')
    .replace(/local-rule/gi, '本地规则')
    .replace(/fallback-default/gi, '默认兜底')
    .replace(/rule-engine/gi, '规则引擎')
    .replace(/\becommerce\b/gi, '电商')
    .replace(/\bwholesale\b/gi, '批发')
    .replace(/\bstall\b/gi, '摆摊')
    .replace(/\bsupermarket\b/gi, '商超')
    .replace(/\bsimple\b/gi, '简装')
    .replace(/\bgift\b/gi, '礼盒')
    .replace(/\bpremium\b/gi, '精品礼盒')
    .replace(/\blow\b/gi, '低')
    .replace(/\bmid\b/gi, '中')
    .replace(/\bhigh\b/gi, '高')
}

function localizeSource(source) {
  if (!source || typeof source !== 'object') return source

  const engineRaw = String(source.engine || '')
  const decisionRaw = String(source.decision || '')
  const engineKey = engineRaw.trim().toLowerCase()
  const decisionKey = decisionRaw.trim().toLowerCase()

  return {
    ...source,
    engine: SOURCE_ENGINE_LABELS[engineKey] || localizeText(engineRaw) || source.engine,
    decision: SOURCE_DECISION_LABELS[decisionKey] || localizeText(decisionRaw) || source.decision
  }
}

function localizeModelVersion(modelVersion) {
  if (modelVersion === null || modelVersion === undefined || modelVersion === '') return modelVersion
  const text = String(modelVersion)
  const key = text.trim().toLowerCase()
  return MODEL_VERSION_LABELS[key] || localizeText(text)
}

function localizeResultView(result) {
  if (!result || typeof result !== 'object') return result

  const recommendation = result.recommendation || {}
  return {
    ...result,
    reason: localizeText(result.reason || ''),
    explanation: localizeText(result.explanation || result.reason || ''),
    recommendation: {
      title: localizeText(recommendation.title || '分级与销售建议'),
      summary: localizeText(recommendation.summary || ''),
      actions: normalizeActions(recommendation.actions).map(localizeText),
      riskNote: localizeText(recommendation.riskNote || ''),
    },
    riskWarning: localizeText(result.riskWarning || ''),
    source: localizeSource(result.source),
    modelVersion: localizeModelVersion(result.modelVersion)
  }
}

function normalizeDefectRatio(raw) {
  if (raw == null) return 0
  return raw >= 1 ? Math.round(raw) : Math.round(raw * 100)
}

function buildScores(r) {
  if (!r) return []
  return [
    { label: '色泽评分', value: r.colorScore ?? 0, color: '' },
    { label: '缺陷率', value: normalizeDefectRatio(r.defectRatio), color: 'defect', suffix: '%' },
    { label: '果径评分', value: r.sizeScore ?? 0, color: '' },
    { label: '成熟度', value: r.maturityScore ?? 0, color: '' }
  ]
}

const priceService = {
  /**
   * 果实分级与定价
   * POST /ai/fruit/grade
   */
  gradeAndPrice(filePath, params = {}) {
    const batchId = normalizeBatchId(params.batchId)
    const formData = {
      channel: params.channel,
      packageType: params.packageType || params.packaging,
      packaging: params.packaging || params.packageType,
      region: params.region,
      batchId,
      diameter: params.diameter,
      brix: params.brix,
      weight: params.weight,
      defectLevel: params.defectLevel
    }

    const realCall = () => {
      if (!filePath) {
        return request({
          url: '/ai/fruit/grade',
          method: 'POST',
          data: formData
        }).then(normalizeGradeResult).then(localizeResultView)
      }

      return uploadFile({
        url: '/ai/fruit/grade',
        filePath,
        name: 'file',
        formData,
        timeout: 70000
      }).then(normalizeGradeResult).then(localizeResultView)
    }

    return tryReal(
      () => realCall(),
      () => {
        const channelCoeff = CHANNEL_COEFF[params.channel] || 1.0
        const packageCoeff = PACKAGE_COEFF[params.packaging || params.packageType] || 1.0
        const adj = channelCoeff * packageCoeff
        const result = {
          ...MOCK_GRADE_RESULT,
          retailMinPrice: +(MOCK_GRADE_RESULT.retailMinPrice * adj).toFixed(1),
          retailMaxPrice: +(MOCK_GRADE_RESULT.retailMaxPrice * adj).toFixed(1),
          wholesaleMinPrice: +(MOCK_GRADE_RESULT.wholesaleMinPrice * adj).toFixed(1),
          wholesaleMaxPrice: +(MOCK_GRADE_RESULT.wholesaleMaxPrice * adj).toFixed(1),
          factors: {
            ...MOCK_GRADE_RESULT.factors,
            渠道系数: String(channelCoeff.toFixed(2)),
            包装系数: String(packageCoeff.toFixed(2))
          }
        }
        return mockResolve(localizeResultView(normalizeGradeResult(result)), 1200)
      }
    )
  },

  /**
   * 获取价格基准线
   * GET /api/price/baseline
   */
  getBaseline(variety, region, gradeCode) {
    return tryReal(
      () => request({ url: '/api/price/baseline', method: 'GET', data: { variety, region } })
        .then(data => normalizeBaseline(data, gradeCode)),
      () => mockResolve(normalizeBaseline({ basePrice: 6.0, unit: '元/斤', updateTime: '2026-03-15' }, gradeCode))
    )
  },

  /**
   * 获取定价建议
   * GET /api/price/suggestion
   */
  getSuggestion(batchId) {
    const normalizedBatchId = normalizeBatchId(batchId)
    return tryReal(
      () => request({ url: '/api/price/suggestion', method: 'GET', data: { batchId: normalizedBatchId } }),
      () =>
        mockResolve({
          suggestedRetailPrice: '6.8 ~ 8.2 元/斤',
          suggestedWholesalePrice: '4.2 ~ 5.5 元/斤',
          factors: MOCK_GRADE_RESULT.factors
        })
    )
  },

  // 仅供页面内部复用
  _buildScores: buildScores,
}

module.exports = priceService
