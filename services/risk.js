const { request, mockResolve, tryReal } = require('./request')

const MOCK_RISK_SUMMARY = {
  riskSummary: '当前病害风险中等，未来3天有连续降雨，请注意巡园'
}

const MOCK_ASSESSMENT = {
  level: 'mid',
  levelText: '中',
  reason: '未来3天有连续降雨，湿度偏高，病害扩散风险增加。结合该批次近期识别到病斑记录，综合评估为中等风险。',
  suggestion: '1. 加强巡园，重点检查已发现病斑区域\n2. 对感染区域补喷波尔多液\n3. 注意田间排水防涝\n4. 降雨结束后及时复查'
}

const MOCK_HISTORY = [
  { id: '1', date: '2026-03-15', level: 'mid', levelText: '中', summary: '连续阴雨，湿度偏高，溃疡病扩散风险上升' },
  { id: '2', date: '2026-03-10', level: 'low', levelText: '低', summary: '天气转晴，温湿度正常，风险回落' },
  { id: '3', date: '2026-03-02', level: 'high', levelText: '高', summary: '暴雨预警，配合历史病斑记录，风险极高' }
]

const riskService = {
  /**
   * 获取风险摘要
   * GET /api/risk/summary
   * @returns {{ riskSummary: string }}
   */
  getSummary() {
    return tryReal(
      () => request({ url: '/api/risk/summary', method: 'GET' }),
      () => mockResolve(MOCK_RISK_SUMMARY)
    )
  },

  /**
   * 获取风险评估
   * GET /api/risk/assessment?batchId=xx
   * @param {string|number} batchId
   * @returns {{ level, levelText, reason, suggestion }}
   */
  getAssessment(batchId) {
    const id = Number(batchId)
    if (!Number.isFinite(id) || id <= 0) {
      return mockResolve(MOCK_ASSESSMENT)
    }
    return tryReal(
      () => request({ url: '/api/risk/assessment', method: 'GET', data: { batchId: id } }),
      () => mockResolve(MOCK_ASSESSMENT)
    )
  },

  /**
   * 获取风险历史
   * GET /api/risk/history
   * @param {{ batch_id?, page?, limit? }} params
   * @returns {Array<{ id, date, level, levelText, summary }>}
   */
  getHistory(params = {}) {
    return tryReal(
      () => request({ url: '/api/risk/history', method: 'GET', data: params }),
      () => mockResolve(MOCK_HISTORY)
    )
  }
}

module.exports = riskService
