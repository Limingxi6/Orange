const { request, mockResolve, tryReal } = require('./request')

const MOCK_WEATHER = {
  location: '宜城市',
  condition: '晴',
  temp: 26,
  humidity: 65,
  wind: '2级'
}

const MOCK_FORECAST_15 = [
  { date: '03-17', day: '今天', icon: '晴',  tempMin: 22, tempMax: 28, humidity: 60, riskScore: 25 },
  { date: '03-18', day: '周三', icon: '多云', tempMin: 20, tempMax: 26, humidity: 65, riskScore: 30 },
  { date: '03-19', day: '周四', icon: '小雨', tempMin: 18, tempMax: 24, humidity: 78, riskScore: 55 },
  { date: '03-20', day: '周五', icon: '中雨', tempMin: 16, tempMax: 22, humidity: 85, riskScore: 72 },
  { date: '03-21', day: '周六', icon: '小雨', tempMin: 17, tempMax: 23, humidity: 82, riskScore: 68 },
  { date: '03-22', day: '周日', icon: '阴',  tempMin: 18, tempMax: 25, humidity: 72, riskScore: 50 },
  { date: '03-23', day: '周一', icon: '晴',  tempMin: 20, tempMax: 27, humidity: 58, riskScore: 28 },
  { date: '03-24', day: '周二', icon: '晴',  tempMin: 21, tempMax: 28, humidity: 55, riskScore: 22 },
  { date: '03-25', day: '周三', icon: '多云', tempMin: 19, tempMax: 26, humidity: 62, riskScore: 32 },
  { date: '03-26', day: '周四', icon: '多云', tempMin: 18, tempMax: 25, humidity: 68, riskScore: 40 },
  { date: '03-27', day: '周五', icon: '小雨', tempMin: 16, tempMax: 23, humidity: 80, riskScore: 60 },
  { date: '03-28', day: '周六', icon: '阴',  tempMin: 17, tempMax: 24, humidity: 75, riskScore: 48 },
  { date: '03-29', day: '周日', icon: '多云', tempMin: 18, tempMax: 26, humidity: 65, riskScore: 35 },
  { date: '03-30', day: '周一', icon: '晴',  tempMin: 20, tempMax: 28, humidity: 58, riskScore: 25 },
  { date: '03-31', day: '周二', icon: '晴',  tempMin: 21, tempMax: 29, humidity: 52, riskScore: 20 }
]

const weatherService = {
  /**
   * 获取实时天气
   * GET /api/weather/current
   * @param {string} [regionCode] - 地区编码
   * @returns {{ location, condition, temp, humidity, wind }}
   */
  getWeather(regionCode) {
    return tryReal(
      () => request({ url: '/api/weather/current', method: 'GET', data: { region_code: regionCode } }),
      () => mockResolve(MOCK_WEATHER)
    )
  },

  /**
   * 获取 15 天预报
   * GET /api/weather/forecast
   * @param {string} [regionCode] - 地区编码
   * @param {number} [days=15]
   * @returns {Array<{ date, day, icon, tempMin, tempMax, humidity, riskScore }>}
   */
  getForecast(regionCode, days = 15) {
    return tryReal(
      () => request({ url: '/api/weather/forecast', method: 'GET', data: { region_code: regionCode, days } }),
      () => mockResolve(MOCK_FORECAST_15.slice(0, days))
    )
  }
}

module.exports = weatherService
