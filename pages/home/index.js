const weatherService = require('../../services/weather')
const riskService = require('../../services/risk')
const batchService = require('../../services/batch')

Page({
  data: {
    loading: true,

    weather: null,
    weatherFailed: false,

    riskSummary: '',
    riskFailed: false,

    quickFunctions: [
      { id: 'recognize', name: '拍照识别', vantIcon: 'photograph', path: '/pages/disease-recognize/index' },
      { id: 'log', name: '农事日志', vantIcon: 'notes-o', path: '/pages/farming-log/index' },
      { id: 'grade', name: '果实分级', vantIcon: 'gem-o', path: '/pages/fruit-grade/index' },
      { id: 'weather', name: '天气预警', vantIcon: 'umbrella-circle', path: '/pages/risk-warning/index' }
    ],

    recentBatches: [],
    batchFailed: false
  },

  onLoad() {
    this.fetchData()
  },

  async fetchData() {
    this.setData({
      loading: true,
      weatherFailed: false,
      riskFailed: false,
      batchFailed: false
    })

    const [weatherRes, riskRes, batchRes] = await Promise.allSettled([
      weatherService.getWeather(),
      riskService.getSummary(),
      batchService.getList({ page: 1, limit: 2, sort: 'latest' })
    ])

    const update = { loading: false }

    if (weatherRes.status === 'fulfilled' && weatherRes.value) {
      update.weather = weatherRes.value
    } else {
      console.error('天气数据加载失败', weatherRes.reason)
      update.weather = null
      update.weatherFailed = true
    }

    if (riskRes.status === 'fulfilled' && riskRes.value) {
      update.riskSummary = riskRes.value.riskSummary || ''
    } else {
      console.error('风险摘要加载失败', riskRes.reason)
      update.riskSummary = ''
      update.riskFailed = true
    }

    if (batchRes.status === 'fulfilled') {
      const list = Array.isArray(batchRes.value) ? batchRes.value : []
      update.recentBatches = list.slice(0, 2)
    } else {
      console.error('批次数据加载失败', batchRes.reason)
      update.recentBatches = []
      update.batchFailed = true
    }

    this.setData(update)
  },

  async onPullDownRefresh() {
    await this.fetchData()
    wx.stopPullDownRefresh()
  },

  onRetry() {
    this.fetchData()
  },

  onQuickFunctionTap(e) {
    const path = e.currentTarget.dataset.path
    if (path) {
      wx.navigateTo({ url: path })
    }
  },

  onBatchTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/batch-detail/index?id=${id}` })
  },

  onRiskTap() {
    wx.navigateTo({ url: '/pages/risk-warning/index' })
  }
})
