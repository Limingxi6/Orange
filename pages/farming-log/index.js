const logService = require('../../services/log')

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
    const batchId = options.batchId || ''
    if (!batchId) {
      this.setData({ loading: false, noBatchId: true })
      return
    }
    this.setData({ batchId })
    this.fetchData(batchId)
  },

  async fetchData(batchId) {
    this.setData({ loading: true, loadFailed: false })
    try {
      const [types, logs] = await Promise.all([
        logService.getTypes(),
        logService.getListByBatch(batchId)
      ])
      this.setData({
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

  /* ---------- 新增日志 ---------- */
  onAddLog() {
    wx.navigateTo({
      url: '/pages/farming-log-create/index?batchId=' + this.data.batchId
    })
  }
})
