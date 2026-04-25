const logService = require('../../services/log')
const PENDING_BATCH_KEY = 'pendingFarmingLogBatchId'
const RECENT_BATCH_KEY = 'recentBatchId'

Page({
  data: {
    loading: true,
    loadFailed: false,
    noBatchId: false,
    batchId: '',
    filterTabs: [],
    currentFilter: 'all',
    logs: [],
    filteredLogs: [],
    showDetail: false,
    detailItem: null
  },

  onLoad(options) {
    const batchId = this._resolveBatchId(options)
    if (!batchId) {
      this.setData({ loading: false, noBatchId: true })
      return
    }
    this.fetchData(batchId)
  },

  onShow() {
    const pendingBatchId = this._consumePendingBatchId()
    if (!pendingBatchId) return
    if (String(pendingBatchId) === String(this.data.batchId) && !this.data.noBatchId) {
      this.fetchData(this.data.batchId)
      return
    }
    this.fetchData(pendingBatchId)
  },

  async fetchData(batchId) {
    const targetBatchId = batchId || this.data.batchId
    if (!targetBatchId) {
      this.setData({ loading: false, noBatchId: true, loadFailed: false })
      return
    }

    this._rememberBatchId(targetBatchId)
    this.setData({ loading: true, loadFailed: false })
    try {
      const [types, logs] = await Promise.all([
        logService.getTypes(),
        logService.getListByBatch(targetBatchId)
      ])
      this.setData({
        batchId: String(targetBatchId),
        noBatchId: false,
        filterTabs: types,
        logs: logs || [],
        loading: false
      }, () => this.applyFilter())
    } catch (err) {
      console.error('农事日志加载失败', err)
      this.setData({ loading: false, loadFailed: true })
    }
  },

  onRetry() {
    this.fetchData(this.data.batchId)
  },

  async onPullDownRefresh() {
    await this.fetchData(this.data.batchId)
    wx.stopPullDownRefresh()
  },

  /* ---------- 筛选 ---------- */
  onFilterTap(e) {
    const value = e.currentTarget.dataset.value
    if (value === this.data.currentFilter) return
    this.setData({ currentFilter: value }, () => this.applyFilter())
  },

  applyFilter() {
    const { currentFilter, logs } = this.data
    const filteredLogs = currentFilter === 'all'
      ? logs
      : logs.filter(item => item.type === currentFilter)
    this.setData({ filteredLogs })
  },

  /* ---------- 详情 ---------- */
  onLogItemTap(e) {
    const { item } = e.detail
    this.setData({ showDetail: true, detailItem: item })
  },

  onCloseDetail() {
    this.setData({ showDetail: false })
  },

  onGoBatchList() {
    wx.switchTab({ url: '/pages/batch-list/index' })
  },

  onGoBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/home/index' })
  },

  /* ---------- 新增日志 ---------- */
  onAddLog() {
    wx.navigateTo({
      url: '/pages/farming-log-create/index?batchId=' + this.data.batchId
    })
  },

  _resolveBatchId(options = {}) {
    const fromOptions = options.batchId || options.id || ''
    if (fromOptions) return String(fromOptions)

    const pending = this._consumePendingBatchId()
    if (pending) return String(pending)

    const app = getApp()
    const fromGlobal = app && app.globalData ? app.globalData.recentBatchId : ''
    if (fromGlobal) return String(fromGlobal)

    const fromStorage = wx.getStorageSync(RECENT_BATCH_KEY)
    return fromStorage ? String(fromStorage) : ''
  },

  _consumePendingBatchId() {
    const app = getApp()
    const fromGlobal = app && app.globalData ? app.globalData.pendingFarmingLogBatchId : ''
    if (fromGlobal) {
      app.globalData.pendingFarmingLogBatchId = ''
      return String(fromGlobal)
    }

    const fromStorage = wx.getStorageSync(PENDING_BATCH_KEY)
    if (fromStorage) {
      wx.removeStorageSync(PENDING_BATCH_KEY)
      return String(fromStorage)
    }
    return ''
  },

  _rememberBatchId(batchId) {
    const id = String(batchId)
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.recentBatchId = id
    }
    wx.setStorageSync(RECENT_BATCH_KEY, id)
  }
})
