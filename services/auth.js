const { request, mockResolve, tryReal } = require('./request')

const MOCK_USER_INFO = {
  nickname: '橘农小李',
  avatar: '',
  phone: '138****0000',
  role: 'farmer',
  userId: 'test_user_001'
}

const authService = {
  /**
   * 保存登录态到本地缓存
   * @param {string} token
   * @param {Object} userInfo
   */
  saveSession(token, userInfo) {
    if (token) wx.setStorageSync('token', token)
    if (userInfo) wx.setStorageSync('userInfo', userInfo)
  },

  /**
   * 清理本地登录态
   */
  clearSession() {
    wx.removeStorageSync('token')
    wx.removeStorageSync('userInfo')
  },

  /**
   * 获取用户信息
   * GET /api/auth/profile
   * @returns {{ nickname, avatar, phone, role, userId }}
   */
  getProfile() {
    return request({ url: '/api/auth/profile', method: 'GET' })
  },

  /**
   * 手机号登录
   * POST /api/auth/login
   * @param {string} phone - 手机号
   * @param {string} password  - 密码（当前登录页输入框沿用 code 变量名）
   * @returns {{ token, userInfo }}
   */
  login(phone, password) {
    return request({ url: '/api/auth/login', method: 'POST', data: { phone, password } })
  },

  /**
   * 发送验证码
   * POST /api/auth/send-code
   * @param {string} phone - 手机号
   * @returns {{ success: boolean }}
   */
  sendCode(phone) {
    return tryReal(
      () => request({ url: '/api/auth/send-code', method: 'POST', data: { phone } }),
      () => mockResolve({ success: true })
    )
  },

  /**
   * 退出登录
   * POST /api/auth/logout
   * @returns {{ success: boolean }}
   */
  logout() {
    return request({ url: '/api/auth/logout', method: 'POST' }).finally(() => {
      authService.clearSession()
    })
  }
}

module.exports = authService
