const { request, uploadFile, mockResolve, tryReal } = require('./request')

const {
  localizeDiseaseLabel,
  localizeDiseaseText,
  normalizeSeverityCode,
  toSeverityText
} = require('./disease-localization')

const MOCK_PREDICT_RESULT = {
  label: '疑似柑橘溃疡病',
  confidence: 0.91,
  severity: 'mid',
  advice: '建议巡园复核并做好通风与清园。',
  needManualReview: false,
  aiSuggestion: {
    title: '病害识别建议',
    summary: '当前识别结果建议先做巡园复核，再根据复核结果安排处置。',
    actions: ['补拍清晰近景图片', '24小时内人工复核'],
    riskNote: '低置信度场景建议优先人工确认',
  },
}

const MOCK_RECORDS = [
  { id: '1', date: '2026-03-16', label: '疑似柑橘溃疡病', confidence: 0.91, severity: 'mid', status: 'review' },
  { id: '2', date: '2026-03-08', label: '叶片状态正常', confidence: 0.95, severity: 'low', status: 'normal' }
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

function normalizeSuggestionDetail(value, fallbackSummary) {
  if (!value || typeof value !== 'object') {
    if (!fallbackSummary) return null
    return {
      title: '病害识别建议',
      summary: localizeDiseaseText(fallbackSummary),
      actions: [],
      riskNote: '',
    }
  }

  const summary = typeof value.summary === 'string' ? localizeDiseaseText(value.summary.trim()) : ''
  const riskNote = typeof value.riskNote === 'string' ? localizeDiseaseText(value.riskNote.trim()) : ''
  const actions = normalizeActions(value.actions).map(item => localizeDiseaseText(item))

  if (!summary && !riskNote && actions.length === 0 && !fallbackSummary) {
    return null
  }

  return {
    title:
      (typeof value.title === 'string' && localizeDiseaseText(value.title.trim())) || '病害识别建议',
    summary: summary || localizeDiseaseText(fallbackSummary || '') || '',
    actions,
    riskNote,
  }
}

function normalizePredictResult(data) {
  if (!data || typeof data !== 'object') return MOCK_PREDICT_RESULT

  const confidence = Number(data.confidence)
  const severityCode = normalizeSeverityCode(data.severity)
  const advice = localizeDiseaseText(data.advice || data.suggestion || '建议人工复核')
  const suggestionDetail = normalizeSuggestionDetail(
    data.aiSuggestion || data.suggestionDetail,
    advice,
  )

  return {
    ...data,
    label: localizeDiseaseLabel(data.label || data.diseaseName),
    confidence: Number.isFinite(confidence) ? confidence : 0,
    severity: severityCode,
    severityText: toSeverityText(severityCode),
    advice,
    needManualReview: Boolean(data.needManualReview),
    imageUrl: data.imageUrl || data.image_url || '',
    image_url: data.image_url || data.imageUrl || '',
    aiSuggestion: suggestionDetail,
    suggestionDetail,
  }
}

function normalizeRecords(res) {
  const list = Array.isArray(res)
    ? res
    : Array.isArray(res && res.list)
    ? res.list
    : []

  return list.map(item => ({
    ...item,
    label: localizeDiseaseLabel(item.label || item.diseaseName || ''),
    severity: normalizeSeverityCode(item.severity),
    severityText: toSeverityText(item.severity)
  }))
}

const diseaseService = {
  /**
   * AI 病害识别
   * POST /ai/disease/predict
   * @param {string} filePath
   * @param {string|number} [batchId]
   */
  predict(filePath, batchId) {
    const formData = {}
    if (batchId !== undefined && batchId !== null && batchId !== '') {
      const parsed = Number(batchId)
      formData.batchId = Number.isFinite(parsed) && parsed > 0 ? parsed : batchId
    }

    return tryReal(
      () =>
        uploadFile({
          url: '/ai/disease/predict',
          filePath,
          name: 'file',
          formData
        }).then(normalizePredictResult),
      () => mockResolve(MOCK_PREDICT_RESULT, 1200)
    )
  },

  /**
   * 病害识别历史
   * GET /api/disease/records
   */
  getRecords(batchId) {
    return tryReal(
      () => request({ url: '/api/disease/records', method: 'GET', data: { batchId } }).then(normalizeRecords),
      () => mockResolve(MOCK_RECORDS)
    )
  }
}

module.exports = diseaseService
