const weatherService = require('../../services/weather')
const riskService = require('../../services/risk')
const batchService = require('../../services/batch')
const traceService = require('../../services/trace')
const { resolveWeatherLocation } = require('../../utils/location')

Page({
  data: {
    loading: true,

    weather: null,
    weatherFailed: false,

    riskSummary: '',
    riskFailed: false,
    scanning: false,

    quickFunctions: [
      { id: 'recognize', name: '拍照识别', vantIcon: 'photograph', path: '/pages/disease-recognize/index' },
      { id: 'scan-trace', name: '扫码溯源', vantIcon: 'scan' },
      { id: 'grade', name: '果实分级', vantIcon: 'gem-o', path: '/pages/fruit-grade/index' },
      { id: 'weather', name: '天气预警', vantIcon: 'umbrella-circle', path: '/pages/risk-warning/index' }
    ],

    recentBatches: [],
    batchFailed: false
  },

  onShow() {
    this.fetchData()
  },

  async fetchData() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ loading: false })
      wx.switchTab({ url: '/pages/mine/index' })
      return
    }

    this.setData({
      loading: true,
      weatherFailed: false,
      riskFailed: false,
      batchFailed: false
    })

    let weatherQuery = { regionCode: '30.5928,114.3055', city: '武汉市' }
    try {
      weatherQuery = await resolveWeatherLocation()
    } catch (err) {
      console.warn('定位失败，回退武汉天气', err)
    }

    const [weatherRes, riskRes, batchRes] = await Promise.allSettled([
      weatherService.getWeather(weatherQuery),
      riskService.getSummary(),
      batchService.getList({ page: 1, limit: 2, sort: 'latest' }, { allowMockFallback: false })
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
    const id = e.currentTarget.dataset.id
    if (id === 'scan-trace') {
      this.onScanTraceCode()
      return
    }

    const path = e.currentTarget.dataset.path
    if (path) {
      if (path === '/pages/disease-recognize/index') {
        const recentBatchId = wx.getStorageSync('recentBatchId')
        if (recentBatchId) {
          wx.navigateTo({ url: `${path}?batchId=${recentBatchId}` })
          return
        }
      }
      wx.navigateTo({ url: path })
    }
  },

  onScanTraceCode() {
    if (this.data.scanning) return

    this.setData({ scanning: true })
    wx.scanCode({
      scanType: ['qrCode'],
      success: (res) => {
        const traceCode = traceService.extractTraceCode(res.result)
        if (!traceCode) {
          wx.showToast({ title: '未识别到有效溯源码', icon: 'none' })
          return
        }

        const tracePath = traceService.buildTraceViewPath(traceCode)
        if (!tracePath) {
          wx.showToast({ title: '未识别到有效溯源码', icon: 'none' })
          return
        }

        wx.navigateTo({ url: tracePath })
      },
      fail: (err) => {
        if (this._isScanCancel(err)) return
        wx.showToast({ title: '扫码失败，请重试', icon: 'none' })
      },
      complete: () => {
        this.setData({ scanning: false })
      },
    })
  },

  _isScanCancel(err) {
    const errMsg = String((err && err.errMsg) || '').toLowerCase()
    return errMsg.includes('cancel')
  },

  onBatchTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/batch-detail/index?id=${id}` })
  },

  onRiskTap() {
    wx.navigateTo({ url: '/pages/risk-warning/index' })
  }
})
