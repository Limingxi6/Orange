import * as echarts from '../../components/ec-canvas/echarts'

const weatherService = require('../../services/weather')
const riskService = require('../../services/risk')

/* ========== 图表配置 ========== */

function buildChartOption(forecastSlice) {
  const list = Array.isArray(forecastSlice) ? forecastSlice : []
  if (!list.length) return null

  const dates = list.map(d => d.date || d.day || '')
  const risks = list.map(d => d.riskScore != null ? d.riskScore : null)
  const humidities = list.map(d => d.humidity != null ? d.humidity : null)
  const tempMaxs = list.map(d => d.tempMax != null ? d.tempMax : null)
  const tempMins = list.map(d => d.tempMin != null ? d.tempMin : null)

  return {
    tooltip: {
      trigger: 'axis',
      confine: true,
      textStyle: { fontSize: 11 }
    },
    legend: {
      data: ['风险指数', '湿度%', '最高温', '最低温'],
      top: 0,
      textStyle: { fontSize: 10, color: '#999' },
      itemWidth: 14,
      itemHeight: 8,
      itemGap: 8
    },
    grid: {
      left: 40, right: 16, top: 36, bottom: 28
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 10, color: '#999' },
      axisLine: { lineStyle: { color: '#E0E0E0' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '',
        min: 0,
        max: 100,
        splitNumber: 4,
        axisLabel: { fontSize: 10, color: '#bbb' },
        splitLine: { lineStyle: { color: '#F0F0F0' } }
      }
    ],
    series: [
      {
        name: '风险指数',
        type: 'line',
        data: risks,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3, color: '#FF8C00' },
        itemStyle: { color: '#FF8C00' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255,140,0,0.25)' },
              { offset: 1, color: 'rgba(255,140,0,0.02)' }
            ]
          }
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: '#F44336', width: 1 },
          label: { formatter: '高风险线', fontSize: 9, color: '#F44336', position: 'insideEndTop' },
          data: [{ yAxis: 60 }]
        }
      },
      {
        name: '湿度%',
        type: 'line',
        data: humidities,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#42A5F5', type: 'dashed' },
        itemStyle: { color: '#42A5F5' }
      },
      {
        name: '最高温',
        type: 'line',
        data: tempMaxs,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#EF5350' },
        itemStyle: { color: '#EF5350' }
      },
      {
        name: '最低温',
        type: 'line',
        data: tempMins,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#66BB6A' },
        itemStyle: { color: '#66BB6A' }
      }
    ]
  }
}

/* ========== 页面 ========== */

let chartInstance = null
let _chartData = []

Page({
  data: {
    loading: true,

    weather: null,
    weatherFailed: false,

    forecast7: [],
    forecastLater: [],
    forecastFailed: false,

    risk: null,
    riskFailed: false,

    historyList: [],
    historyFailed: false,

    expandLater: [],

    ec: {
      onInit(canvas, width, height, dpr) {
        chartInstance = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
        canvas.setChart(chartInstance)
        if (_chartData.length) {
          const opt = buildChartOption(_chartData)
          if (opt) chartInstance.setOption(opt)
        }
        return chartInstance
      }
    }
  },

  onLoad() {
    this.fetchData()
  },

  async fetchData() {
    this.setData({
      loading: true,
      weatherFailed: false,
      forecastFailed: false,
      riskFailed: false,
      historyFailed: false
    })

    const [weatherRes, forecastRes, riskRes, historyRes] = await Promise.allSettled([
      weatherService.getWeather(),
      weatherService.getForecast(null, 15),
      riskService.getAssessment('default'),
      riskService.getHistory()
    ])

    const update = { loading: false }
    let forecast7 = []

    // --- 天气 ---
    if (weatherRes.status === 'fulfilled' && weatherRes.value) {
      update.weather = weatherRes.value
    } else {
      console.error('天气数据加载失败', weatherRes.reason)
      update.weather = null
      update.weatherFailed = true
    }

    // --- 15 天预报 ---
    if (forecastRes.status === 'fulfilled') {
      const list = Array.isArray(forecastRes.value) ? forecastRes.value : []
      forecast7 = list.slice(0, 7)
      update.forecast7 = forecast7
      update.forecastLater = list.slice(7)
    } else {
      console.error('预报数据加载失败', forecastRes.reason)
      update.forecast7 = []
      update.forecastLater = []
      update.forecastFailed = true
    }

    // --- 风险评估 ---
    if (riskRes.status === 'fulfilled' && riskRes.value) {
      update.risk = riskRes.value
    } else {
      console.error('风险评估加载失败', riskRes.reason)
      update.risk = null
      update.riskFailed = true
    }

    // --- 历史预警 ---
    if (historyRes.status === 'fulfilled') {
      update.historyList = Array.isArray(historyRes.value) ? historyRes.value : []
    } else {
      console.error('历史预警加载失败', historyRes.reason)
      update.historyList = []
      update.historyFailed = true
    }

    this.setData(update)

    // 更新图表（双保险：onInit 和这里都可触发）
    _chartData = forecast7
    if (chartInstance && forecast7.length) {
      const opt = buildChartOption(forecast7)
      if (opt) {
        try { chartInstance.setOption(opt) } catch (e) { /* chart 可能已销毁，由 onInit 重建 */ }
      }
    }
  },

  async onPullDownRefresh() {
    chartInstance = null
    await this.fetchData()
    wx.stopPullDownRefresh()
  },

  onRetry() {
    this.fetchData()
  },

  onExpandChange(e) {
    this.setData({ expandLater: e.detail })
  }
})
