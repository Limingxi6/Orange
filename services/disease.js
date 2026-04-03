const { request, mockResolve, tryReal } = require('./request')

const MOCK_PREDICT_RESULT = {
  label: '疑似柑橘溃疡病',
  confidence: 0.91,
  severity: '中',
  advice: '建议巡园复核，保持通风，必要时联系专家',
  needManualReview: true
}

const MOCK_RECORDS = [
  { id: '1', date: '2026-03-16', label: '疑似柑橘溃疡病', confidence: 0.91, severity: '中', status: 'review' },
  { id: '2', date: '2026-03-08', label: '健康', confidence: 0.95, severity: '无', status: 'normal' }
]

const diseaseService = {
  /**
   * AI 病害识别
   * POST /api/disease/predict
   * @param {string} filePath - 本地图片路径
   * @param {string} [batchId] - 关联批次 ID
   * @returns {{ label, confidence, severity, advice, needManualReview }}
   */
  predict(filePath, batchId) {
    return tryReal(
      () => request({
        url: '/api/disease/predict',
        method: 'POST',
        data: { batchId: batchId || undefined, filePath }
      }),
      () => mockResolve(MOCK_PREDICT_RESULT, 1200)
    )
  },

  /**
   * 病害识别历史
   * GET /api/disease/records
   * @param {string} [batchId] - 按批次筛选
   * @returns {Array<{ id, date, label, confidence, severity, status }>}
   */
  getRecords(batchId) {
    return tryReal(
      () => request({ url: '/api/disease/records', method: 'GET', data: { batchId } }),
      () => mockResolve(MOCK_RECORDS)
    )
  }
}

module.exports = diseaseService
