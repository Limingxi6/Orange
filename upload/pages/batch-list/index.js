const batchService = require('../../services/batch')

const STATUS_TAG_MAP = { '种植中': 'warning', '已采收': 'primary' }

let _searchTimer = null

Page({
  data: {
    loading: true,
    loadFailed: false,
    searchValue: '',
    batchList: []
  },

  onLoad() {
    this.fetchList()
  },

  async fetchList(keyword) {
    this.setData({ loading: true, loadFailed: false })
    try {
      const params = {}
      if (keyword) params.keyword = keyword
      const list = await batchService.getList(params)
      const arr = Array.isArray(list) ? list : []
      arr.forEach(b => { b.tagType = STATUS_TAG_MAP[b.status] || 'default' })
      this.setData({ batchList: arr, loading: false })
    } catch (err) {
      console.error('批次列表加载失败', err)
      this.setData({ loading: false, loadFailed: true })
    }
  },

  onRetry() {
    this.fetchList(this.data.searchValue)
  },

  async onPullDownRefresh() {
    await this.fetchList(this.data.searchValue)
    wx.stopPullDownRefresh()
  },

  onSearchChange(e) {
    const keyword = (e.detail || '').trim()
    this.setData({ searchValue: keyword })
    if (_searchTimer) clearTimeout(_searchTimer)
    _searchTimer = setTimeout(() => this.fetchList(keyword), 350)
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/batch-detail/index?id=${id}` })
  },

  onAddBatch() {
    wx.navigateTo({ url: '/pages/batch-create/index' })
  }
})
