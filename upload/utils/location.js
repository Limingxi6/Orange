const CACHE_KEY = 'weather_geo_cache_v1'
const CACHE_TTL_MS = 30 * 60 * 1000
const LOCATION_TIMEOUT_MS = 2500

const WUHAN_FALLBACK = {
  city: '武汉市',
  latitude: 30.5928,
  longitude: 114.3055
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatRegionCode(latitude, longitude) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return ''
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`
}

function getCachedLocation() {
  const cached = wx.getStorageSync(CACHE_KEY)
  if (!cached || typeof cached !== 'object') return null
  if (!isFiniteNumber(cached.latitude) || !isFiniteNumber(cached.longitude)) return null
  if (!isFiniteNumber(cached.ts)) return null
  if (Date.now() - cached.ts > CACHE_TTL_MS) return null
  return cached
}

function setCachedLocation(latitude, longitude) {
  wx.setStorageSync(CACHE_KEY, {
    latitude,
    longitude,
    ts: Date.now()
  })
}

function getLocation() {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`getLocation timeout after ${LOCATION_TIMEOUT_MS}ms`))
    }, LOCATION_TIMEOUT_MS)

    wx.getLocation({
      type: 'wgs84',
      isHighAccuracy: true,
      success: (res) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(res)
      },
      fail: (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      }
    })
  })
}

async function resolveWeatherLocation(options = {}) {
  const forceRefresh = !!options.forceRefresh

  if (!forceRefresh) {
    const cached = getCachedLocation()
    if (cached) {
      return {
        regionCode: formatRegionCode(cached.latitude, cached.longitude),
        city: '',
        source: 'cache'
      }
    }
  }

  try {
    const res = await getLocation()
    const latitude = Number(res.latitude)
    const longitude = Number(res.longitude)
    if (isFiniteNumber(latitude) && isFiniteNumber(longitude)) {
      setCachedLocation(latitude, longitude)
      return {
        regionCode: formatRegionCode(latitude, longitude),
        city: '',
        source: 'gps'
      }
    }
  } catch (err) {
    console.warn('[location] getLocation failed, fallback to Wuhan', err)
  }

  return {
    regionCode: formatRegionCode(WUHAN_FALLBACK.latitude, WUHAN_FALLBACK.longitude),
    city: WUHAN_FALLBACK.city,
    source: 'fallback'
  }
}

module.exports = {
  resolveWeatherLocation,
  formatRegionCode,
  WUHAN_FALLBACK
}
