const productService = require('../../services/product')

Page({
  data: {
    loading: true,
    loadFailed: false,
    products: [],

    generatingId: ''
  },

  onLoad() {
    this.fetchList()
  },

  async fetchList() {
    this.setData({ loading: true, loadFailed: false })
    try {
      const list = await productService.getList()
      const products = Array.isArray(list) ? list : []
      this.setData({ products, loading: false })
    } catch (err) {
      console.error('产品列表加载失败', err)
      this.setData({ loading: false, loadFailed: true })
    }
  },

  onRetry() {
    this.fetchList()
  },

  async onPullDownRefresh() {
    await this.fetchList()
    wx.stopPullDownRefresh()
  },

  async onGenerateQrcode(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.generatingId) return
    this.setData({ generatingId: id })

    try {
      const res = await productService.generateQrcode(id)
      const qrcodeUrl = (res && res.qrcodeUrl) || ''
      const expireTime = (res && res.expireTime) || ''

      const products = this.data.products.map(p =>
        p.id === id ? { ...p, qrcodeGenerated: true, qrcodeUrl, expireTime } : p
      )
      this.setData({ products })
      wx.showToast({ title: '二维码已生成', icon: 'success' })
    } catch (err) {
      if (!err._toasted) {
        wx.showToast({ title: err.message || '生成失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ generatingId: '' })
    }
  },

  onViewQrcode(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p.id === id)
    const url = product && product.qrcodeUrl
    if (url) {
      wx.previewImage({ urls: [url], current: url })
    } else {
      wx.showToast({ title: '二维码地址不可用', icon: 'none' })
    }
  },

  onViewTrace(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p.id === id) || {}
    const traceCode = product.traceCode || id
    wx.navigateTo({ url: `/pages/trace-view/index?traceCode=${traceCode}` })
  },

  onShareProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({ title: '分享功能开发中', icon: 'none' })
  }
})
