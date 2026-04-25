const { request, mockResolve, tryReal } = require('./request')

const WUHAN_FALLBACK = {
  city: '武汉市',
  regionCode: '30.5928,114.3055'
}

const MOCK_WEATHER = {
  location: WUHAN_FALLBACK.city,
  condition: '晴',
  temp: 26,
  humidity: 65,
  wind: '2级'
}

const MOCK_FORECAST_15 = [
  { date: '03-17', day: '今天', icon: '晴', tempMin: 22, tempMax: 28, humidity: 60, riskScore: 25 },
  { date: '03-18', day: '周三', icon: '多云', tempMin: 20, tempMax: 26, humidity: 65, riskScore: 30 },
  { date: '03-19', day: '周四', icon: '小雨', tempMin: 18, tempMax: 24, humidity: 78, riskScore: 55 },
  { date: '03-20', day: '周五', icon: '中雨', tempMin: 16, tempMax: 22, humidity: 85, riskScore: 72 },
  { date: '03-21', day: '周六', icon: '小雨', tempMin: 17, tempMax: 23, humidity: 82, riskScore: 68 },
  { date: '03-22', day: '周日', icon: '阴', tempMin: 18, tempMax: 25, humidity: 72, riskScore: 50 },
  { date: '03-23', day: '周一', icon: '晴', tempMin: 20, tempMax: 27, humidity: 58, riskScore: 28 },
  { date: '03-24', day: '周二', icon: '晴', tempMin: 21, tempMax: 28, humidity: 55, riskScore: 22 },
  { date: '03-25', day: '周三', icon: '多云', tempMin: 19, tempMax: 26, humidity: 62, riskScore: 32 },
  { date: '03-26', day: '周四', icon: '多云', tempMin: 18, tempMax: 25, humidity: 68, riskScore: 40 },
  { date: '03-27', day: '周五', icon: '小雨', tempMin: 16, tempMax: 23, humidity: 80, riskScore: 60 },
  { date: '03-28', day: '周六', icon: '阴', tempMin: 17, tempMax: 24, humidity: 75, riskScore: 48 },
  { date: '03-29', day: '周日', icon: '多云', tempMin: 18, tempMax: 26, humidity: 65, riskScore: 35 },
  { date: '03-30', day: '周一', icon: '晴', tempMin: 20, tempMax: 28, humidity: 58, riskScore: 25 },
  { date: '03-31', day: '周二', icon: '晴', tempMin: 21, tempMax: 29, humidity: 52, riskScore: 20 }
]

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function normalizeWeatherQuery(input) {
  if (!input) return { regionCode: '', city: '' }

  if (typeof input === 'string') {
    return {
      regionCode: input.trim(),
      city: ''
    }
  }

  if (typeof input === 'object') {
    const latitude = Number(input.latitude)
    const longitude = Number(input.longitude)
    const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude)

    const regionCode = hasCoords
      ? `${latitude.toFixed(4)},${longitude.toFixed(4)}`
      : String(input.regionCode || input.region_code || '').trim()

    return {
      regionCode,
      city: String(input.city || '').trim()
    }
  }

  return { regionCode: '', city: '' }
}

function normalizeCurrent(data) {
  const locationRaw = String(data.location || data.city || '').trim()
  const looksLikeCoordinates = locationRaw.startsWith('地区') && locationRaw.includes(',')
  const location = locationRaw
    ? (looksLikeCoordinates ? '当前位置' : locationRaw)
    : WUHAN_FALLBACK.city

  return {
    ...data,
    location,
    condition: String(data.condition || data.weather || '未知'),
    temp: toNumber(data.temp, toNumber(data.temperature, 0)),
    humidity: toNumber(data.humidity, 0),
    wind: String(data.wind || data.windSpeed || 'N/A')
  }
}

function estimateRiskScore(icon, humidity) {
  const weatherText = String(icon || '')
  let score = Math.round(toNumber(humidity, 50) * 0.6 - 20)

  if (/雨|雪|雷暴/.test(weatherText)) score += 25
  else if (/阴|雾/.test(weatherText)) score += 10

  return clamp(score, 0, 100)
}

function normalizeForecastItem(item) {
  const icon = String(item.icon || item.weather || '未知')
  const humidity = toNumber(item.humidity, 0)

  return {
    ...item,
    date: String(item.date || ''),
    day: String(item.day || ''),
    icon,
    tempMin: toNumber(item.tempMin, toNumber(item.minTemp, 0)),
    tempMax: toNumber(item.tempMax, toNumber(item.maxTemp, 0)),
    humidity,
    riskScore: item.riskScore != null ? toNumber(item.riskScore, 0) : estimateRiskScore(icon, humidity)
  }
}

function normalizeForecastResponse(data, days) {
  const list = Array.isArray(data)
    ? data
    : (data && Array.isArray(data.days) ? data.days : [])

  return list.slice(0, days).map((item) => normalizeForecastItem(item || {}))
}

const weatherService = {
  getWeather(query) {
    const { regionCode, city } = normalizeWeatherQuery(query)

    return tryReal(
      () => request({
        url: '/api/weather/current',
        method: 'GET',
        data: { region_code: regionCode, city }
      }).then((res) => normalizeCurrent(res || {})),
      () => mockResolve(MOCK_WEATHER)
    )
  },

  getForecast(query, days = 15) {
    const { regionCode, city } = normalizeWeatherQuery(query)

    return tryReal(
      () => request({
        url: '/api/weather/forecast',
        method: 'GET',
        data: { region_code: regionCode, city, days }
      }).then((res) => normalizeForecastResponse(res, days)),
      () => mockResolve(MOCK_FORECAST_15.slice(0, days))
    )
  }
}

module.exports = weatherService
