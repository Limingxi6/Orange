const { request, mockResolve, tryReal } = require('./request')

const MOCK_RISK_SUMMARY = {
  riskSummary: '当前病害风险中等，未来3天有连续降雨，请注意巡园。'
}

const MOCK_ASSESSMENT = {
  level: 'mid',
  levelText: '中',
  reason: '未来3天有连续降雨，湿度偏高，病害扩散风险增加。',
  suggestion: '1. 加强巡园\n2. 对可疑区域补防\n3. 雨后及时复查',
  aiAdvice: {
    title: '风险处置建议',
    summary: '建议先巡园排查高风险点位，再安排复核与补防。',
    actions: ['优先巡园', '24小时内复核', '复核后补防'],
    riskNote: '风险等级由规则引擎判定，AI建议仅作增强参考',
  }
}

const MOCK_HISTORY = [
  { id: '1', date: '2026-03-15', level: 'mid', levelText: '中', summary: '连续阴雨，湿度偏高，病害扩散风险上升' },
  { id: '2', date: '2026-03-10', level: 'low', levelText: '低', summary: '天气转晴，风险回落' },
  { id: '3', date: '2026-03-02', level: 'high', levelText: '高', summary: '暴雨预警叠加历史病害记录，综合风险偏高' }
]

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

function normalizeAiAdvice(value, fallbackSummary, fallbackSuggestion) {
  if (!value || typeof value !== 'object') {
    return {
      title: '风险处置建议',
      summary: fallbackSummary || '',
      actions: normalizeActions(fallbackSuggestion),
      riskNote: '',
    }
  }

  const actions = normalizeActions(value.actions)

  return {
    title: (typeof value.title === 'string' && value.title.trim()) || '风险处置建议',
    summary: (typeof value.summary === 'string' && value.summary.trim()) || fallbackSummary || '',
    actions: actions.length ? actions : normalizeActions(fallbackSuggestion),
    riskNote: (typeof value.riskNote === 'string' && value.riskNote.trim()) || '',
  }
}

function normalizeAssessment(data) {
  if (!data || typeof data !== 'object') return MOCK_ASSESSMENT

  const reason = data.reason || ''
  const suggestion = data.suggestion || ''
  const aiAdvice = normalizeAiAdvice(data.aiAdvice || data.enrichedSuggestion, reason, suggestion)

  return {
    ...data,
    reason,
    suggestion,
    aiAdvice,
    enrichedSuggestion: data.enrichedSuggestion || (aiAdvice.actions.length ? aiAdvice.actions.join('；') : suggestion),
  }
}

function normalizeHistory(res) {
  const list = Array.isArray(res)
    ? res
    : Array.isArray(res && res.list)
      ? res.list
      : []

  return list.map(item => {
    const reason = item.summary || ''
    const suggestion = item.suggestion || ''
    return {
      ...item,
      aiAdvice: normalizeAiAdvice(item.aiAdvice, reason, suggestion),
      enrichedSuggestion: item.enrichedSuggestion || suggestion,
    }
  })
}

const riskService = {
  getSummary() {
    return tryReal(
      () => request({ url: '/api/risk/summary', method: 'GET' }),
      () => mockResolve(MOCK_RISK_SUMMARY)
    )
  },

  getAssessment(batchId) {
    const id = Number(batchId)
    if (!Number.isFinite(id) || id <= 0) {
      return mockResolve(normalizeAssessment(MOCK_ASSESSMENT))
    }

    return tryReal(
      () => request({ url: `/api/risk/${id}`, method: 'GET' }).then(normalizeAssessment),
      () => mockResolve(normalizeAssessment(MOCK_ASSESSMENT))
    )
  },

  getHistory(params = {}) {
    return tryReal(
      () => request({ url: '/api/risk/history', method: 'GET', data: params }).then(normalizeHistory),
      () => mockResolve(normalizeHistory(MOCK_HISTORY))
    )
  }
}

module.exports = riskService
