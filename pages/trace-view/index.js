const traceService = require('../../services/trace')

Page({
  data: {
    traceCode: '',
    noTraceCode: false,
    loading: true,
    loadFailed: false,

    batchInfo: null,
    gradeInfo: null,
    timeline: [],
    diseaseRecords: [],
    chainAnchors: [],
    overallChainStatus: '',
    verifiedCount: 0,
    totalAnchorCount: 0,

    verifying: false,
    verifyFailed: false,
    expandChain: ['chain']
  },

  onLoad(options) {
    const traceCode = options.traceCode || options.batchId || options.scene || ''
    if (!traceCode) {
      this.setData({ loading: false, noTraceCode: true })
      return
    }
    this.setData({ traceCode })
    this.fetchTrace(traceCode)
  },

  async fetchTrace(traceCode) {
    this.setData({ loading: true, loadFailed: false })
    try {
      const data = await traceService.getInfo(traceCode)
      if (!data) {
        this.setData({ loading: false, loadFailed: true })
        return
      }

      this.setData({
        loading: false,
        batchInfo: data.batchInfo || null,
        gradeInfo: data.gradeInfo || null,
        timeline: Array.isArray(data.timeline) ? data.timeline : [],
        diseaseRecords: Array.isArray(data.diseaseRecords) ? data.diseaseRecords : [],
        chainAnchors: Array.isArray(data.chainAnchors) ? data.chainAnchors : [],
        overallChainStatus: data.overallChainStatus || '',
        verifiedCount: data.verifiedCount || 0,
        totalAnchorCount: data.totalAnchorCount || 0
      })
    } catch (err) {
      console.error('溯源信息加载失败', err)
      this.setData({ loading: false, loadFailed: true })
      if (!err._toasted) {
        wx.showToast({ title: '加载溯源信息失败', icon: 'none' })
      }
    }
  },

  onRetry() {
    this.fetchTrace(this.data.traceCode)
  },

  async onPullDownRefresh() {
    await this.fetchTrace(this.data.traceCode)
    wx.stopPullDownRefresh()
  },

  async onVerifyChain() {
    if (this.data.verifying) return
    this.setData({ verifying: true, verifyFailed: false })
    try {
      const res = await traceService.verifyChain(this.data.traceCode)
      const isVerified = res && res.status === 'verified'

      if (isVerified) {
        const anchors = this.data.chainAnchors.map(a => ({ ...a, status: 'verified' }))
        this.setData({
          chainAnchors: anchors,
          overallChainStatus: 'verified',
          verifiedCount: anchors.length,
          totalAnchorCount: anchors.length
        })
        wx.showToast({ title: res.message || '全部验证通过', icon: 'success' })
      } else {
        this.setData({ overallChainStatus: 'failed', verifyFailed: true })
        wx.showToast({ title: (res && res.message) || '验证未通过', icon: 'none' })
      }
    } catch (err) {
      this.setData({ verifyFailed: true })
      if (!err._toasted) {
        wx.showToast({ title: '验证失败，请稍后重试', icon: 'none' })
      }
    } finally {
      this.setData({ verifying: false })
    }
  },

  onCollapseChange(e) {
    this.setData({ expandChain: e.detail })
  },

  onCopyTxId(e) {
    const txId = e.currentTarget.dataset.txid
    if (!txId) return
    wx.setClipboardData({
      data: txId,
      success() { wx.showToast({ title: '已复制交易ID', icon: 'success' }) }
    })
  }
})
