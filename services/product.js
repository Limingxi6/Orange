const { request, mockResolve, tryReal } = require('./request')

const MOCK_PRODUCTS = [
  {
    id: 1,
    batchName: '2026春-纽荷尔脐橙A区',
    variety: '纽荷尔脐橙',
    grade: '一级果',
    status: '已上架',
    price: '6.8~8.2元/斤',
    qrcodeGenerated: true
  },
  {
    id: 2,
    batchName: '2025秋-纽荷尔脐橙B区',
    variety: '纽荷尔脐橙',
    grade: '二级果',
    status: '待上架',
    price: '4.5~5.8元/斤',
    qrcodeGenerated: false
  }
]

const productService = {
  /**
   * 获取产品列表
   * GET /api/products
   * @param {{ page?, limit? }} params
   * @returns {Array<{ id, batchName, variety, grade, status, price, qrcodeGenerated }>}
   */
  getList(params = {}) {
    return tryReal(
      () => request({ url: '/api/products', method: 'GET', data: params }),
      () => mockResolve(MOCK_PRODUCTS)
    )
  },

  /**
   * 生成产品溯源二维码
   * POST /api/products/:id/qrcode
   * @param {string|number} batchId
   * @returns {{ qrcodeUrl, expireTime }}
   */
  generateQrcode(batchId) {
    return tryReal(
      () => request({ url: `/api/products/${batchId}/qrcode`, method: 'POST', data: {} }),
      () => mockResolve({ qrcodeUrl: 'https://mock.qrcode.url/batch/' + batchId, expireTime: '2027-01-01' })
    )
  }
}

module.exports = productService
