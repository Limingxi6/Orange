const batchService = require('../../services/batch')
const logService = require('../../services/log')

const STATUS_CLASS_MAP = { '种植中': 'planting', '已采收': 'harvested' }

const STAGE_OPTIONS = [
  { name: '苗期' },
  { name: '花期' },
  { name: '幼果期' },
  { name: '果实膨大期' },
  { name: '转色期' },
  { name: '成熟期' },
  { name: '已采收' }
]

Page({
  data: {
    loading: true,
    loadFailed: false,
    noBatchId: false,
    batchId: '',
    batch: {},
    logList: [],
    logEmpty: false,
    stageActions: STAGE_OPTIONS,
    showStageSheet: false,
    stageUpdating: false
  },

  onLoad(options) {
    const id = options.id || ''
    if (!id) {
      this.setData({ loading: false, noBatchId: true })
      return
    }
    this.setData({ batchId: id })
    this.fetchData(id)
  },

  async fetchData(id) {
    this.setData({ loading: true, loadFailed: false })
    try {
      const [batch, logList] = await Promise.all([
        batchService.getDetail(id),
        logService.getListByBatch(id)
      ])
      batch.statusClass = STATUS_CLASS_MAP[batch.status] || 'planting'
      const logs = Array.isArray(logList) ? logList : []
      const recentLogs = logs.slice(0, 5)
      this.setData({
        batch,
        logList: recentLogs,
        logEmpty: recentLogs.length === 0,
        loading: false
      })
    } catch (err) {
      console.error('批次详情加载失败', err)
      this.setData({ loading: false, loadFailed: true })
    }
  },

  onRetry() {
    this.fetchData(this.data.batchId)
  },

  onPhotoRecognize() {
    wx.navigateTo({ url: `/pages/disease-recognize/index?batchId=${this.data.batchId}` })
  },

  onLogRecord() {
    wx.navigateTo({ url: `/pages/farming-log/index?batchId=${this.data.batchId}` })
  },

  onViewWarning() {
    wx.navigateTo({ url: '/pages/risk-warning/index' })
  },

  onOpenStageSheet() {
    if (this.data.stageUpdating) return
    this.setData({ showStageSheet: true })
  },

  onCloseStageSheet() {
    this.setData({ showStageSheet: false })
  },

  async onStageSelect(e) {
    const { name } = e.detail
    if (name === this.data.batch.stage) {
      this.setData({ showStageSheet: false })
      return
    }

    this.setData({ showStageSheet: false, stageUpdating: true })
    wx.showLoading({ title: '更新中…', mask: true })

    try {
      await batchService.updateStage(this.data.batchId, name)
      wx.hideLoading()
      wx.showToast({ title: '阶段已更新', icon: 'success' })
      this.fetchData(this.data.batchId)
    } catch (err) {
      wx.hideLoading()
      console.error('阶段更新失败', err)
      wx.showToast({ title: '更新失败，请重试', icon: 'none' })
    } finally {
      this.setData({ stageUpdating: false })
    }
  }
})
