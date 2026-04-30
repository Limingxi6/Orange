const batchService = require('../../services/batch')
const logService = require('../../services/log')
const RECENT_BATCH_KEY = 'recentBatchId'

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
    stageUpdating: false,
    deleting: false
  },

  onLoad(options) {
    const id = options.id || ''
    if (!id) {
      this.setData({ loading: false, noBatchId: true })
      return
    }
    this.setData({ batchId: id })
    this._rememberBatchId(id)
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
  },

  async onDeleteBatch() {
    if (this.data.deleting || !this.data.batchId) return

    const confirmed = await this._confirmDelete()
    if (!confirmed) return

    this.setData({ deleting: true })
    wx.showLoading({ title: '删除中...', mask: true })

    try {
      await batchService.remove(this.data.batchId)
      wx.hideLoading()
      wx.showToast({ title: '批次已删除', icon: 'success' })
      this._refreshPreviousListPage()
      setTimeout(() => {
        wx.navigateBack()
      }, 300)
    } catch (err) {
      wx.hideLoading()
      console.error('删除批次失败', err)
      wx.showToast({ title: (err && err.message) || '删除失败，请重试', icon: 'none' })
    } finally {
      this.setData({ deleting: false })
    }
  },

  _rememberBatchId(batchId) {
    const id = String(batchId)
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.recentBatchId = id
    }
    wx.setStorageSync(RECENT_BATCH_KEY, id)
  },

  _confirmDelete() {
    return new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: '删除后不可恢复，并会一并删除该批次的日志、病害、风险、分级、产品与溯源数据。',
        confirmText: '删除',
        confirmColor: '#E54D42',
        success: (res) => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })
  },

  _refreshPreviousListPage() {
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    if (prevPage && typeof prevPage.fetchList === 'function') {
      const keyword = prevPage.data && prevPage.data.searchValue
      prevPage.fetchList(keyword)
    }
  }
})
