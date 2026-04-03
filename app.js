App({
  globalData: {
    userInfo: null
  },

  onLaunch() {
    // 预加载 Vant 图标字体，避免渲染层 ERR_CACHE_MISS
    wx.loadFontFace({
      global: true,
      family: 'vant-icon',
      source: 'url("https://at.alicdn.com/t/c/font_2553510_kfwma2yq1rs.woff2?t=1694918397022")',
      scopes: ['webview', 'native'],
    })

    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    const authService = require('./services/auth')
    const token = wx.getStorageSync('token')
    if (!token) return

    const cached = wx.getStorageSync('userInfo')
    if (cached) this.globalData.userInfo = cached

    authService.getProfile().then(info => {
      this.globalData.userInfo = info
      authService.saveSession(token, info)
    }).catch(() => {
      authService.clearSession()
      this.globalData.userInfo = null
    })
  }
})
