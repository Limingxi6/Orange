const { request, mockResolve, tryReal } = require('./request')

const MOCK_GRADE_RESULT = {
  variety: '纽荷尔脐橙',
  grade: '一级果',
  colorScore: 92,
  defectRatio: 0.03,
  sizeScore: 88,
  maturityScore: 90,
  retailMinPrice: 6.8,
  retailMaxPrice: 8.2,
  wholesaleMinPrice: 4.2,
  wholesaleMaxPrice: 5.5,
  reason: '色泽均匀，表皮缺陷极少，果径较大（约 75mm），成熟度高，追溯记录完整',
  riskWarning: '最终价格受地区供需和市场波动影响，以上建议仅供参考',
  factors: {
    '市场基准价': '6.0 元/斤',
    '品质系数': '1.10',
    '渠道系数': '1.05',
    '包装系数': '1.00',
    '追溯溢价': '1.08'
  }
}

const CHANNEL_COEFF = { '电商': 1.05, '批发': 0.85, '摆摊': 0.95 }
const PACKAGE_COEFF = { '简装': 1.00, '礼盒': 1.15 }

const priceService = {
  /**
   * 果实分级与定价
   * POST /api/price/grade
   * @param {string} filePath - 本地图片路径
   * @param {{ channel, packaging, region }} params
   * @returns {{ variety, grade, colorScore, defectRatio, sizeScore, maturityScore, retailMinPrice, retailMaxPrice, wholesaleMinPrice, wholesaleMaxPrice, reason, riskWarning, factors }}
   */
  gradeAndPrice(filePath, params) {
    const payload = {
      ...(params || {}),
      // 后端 DTO 使用 packageType，前端入参常见为 packaging
      packageType: (params && (params.packageType || params.packaging)) || undefined,
      imageUrl: filePath
    }
    return tryReal(
      () => request({ url: '/api/price/grade', method: 'POST', data: payload }),
      () => {
        const channelCoeff = CHANNEL_COEFF[params.channel] || 1.0
        const packageCoeff = PACKAGE_COEFF[params.packaging] || 1.0
        const adj = channelCoeff * packageCoeff
        const result = {
          ...MOCK_GRADE_RESULT,
          retailMinPrice: +(MOCK_GRADE_RESULT.retailMinPrice * adj).toFixed(1),
          retailMaxPrice: +(MOCK_GRADE_RESULT.retailMaxPrice * adj).toFixed(1),
          wholesaleMinPrice: +(MOCK_GRADE_RESULT.wholesaleMinPrice * adj).toFixed(1),
          wholesaleMaxPrice: +(MOCK_GRADE_RESULT.wholesaleMaxPrice * adj).toFixed(1),
          factors: {
            ...MOCK_GRADE_RESULT.factors,
            '渠道系数': String(channelCoeff.toFixed(2)),
            '包装系数': String(packageCoeff.toFixed(2))
          }
        }
        return mockResolve(result, 1200)
      }
    )
  },

  /**
   * 获取价格基准线
   * GET /api/price/baseline
   * @param {string} variety - 品种
   * @param {string} region  - 地区
   * @returns {{ basePrice, unit, updateTime }}
   */
  getBaseline(variety, region) {
    return tryReal(
      () => request({ url: '/api/price/baseline', method: 'GET', data: { variety, region } }),
      () => mockResolve({ basePrice: 6.0, unit: '元/斤', updateTime: '2026-03-15' })
    )
  },

  /**
   * 获取定价建议
   * GET /api/price/suggestion?batchId=...
   * @param {string|number} batchId
   * @returns {{ suggestedRetailPrice, suggestedWholesalePrice, factors }}
   */
  getSuggestion(batchId) {
    return tryReal(
      () => request({ url: '/api/price/suggestion', method: 'GET', data: { batchId } }),
      () => mockResolve({
        suggestedRetailPrice: '6.8 ~ 8.2 元/斤',
        suggestedWholesalePrice: '4.2 ~ 5.5 元/斤',
        factors: MOCK_GRADE_RESULT.factors
      })
    )
  }
}

module.exports = priceService
