const { request, mockResolve, tryReal } = require('./request')

const MOCK_USER_INFO = {
  nickname: '姗樺啘灏忔潕',
  avatar: '',
  phone: '138****0000',
  role: 'farmer',
  userId: 'test_user_001'
}

const authService = {
  /**
   * 淇濆瓨鐧诲綍鎬佸埌鏈湴缂撳瓨
   * @param {string} token
   * @param {Object} userInfo
   */
  saveSession(token, userInfo) {
    if (token) wx.setStorageSync('token', token)
    if (userInfo) wx.setStorageSync('userInfo', userInfo)
  },

  /**
   * 娓呯悊鏈湴鐧诲綍鎬?
   */
  clearSession() {
    wx.removeStorageSync('token')
    wx.removeStorageSync('userInfo')
  },

  /**
   * 鑾峰彇鐢ㄦ埛淇℃伅
   * GET /api/auth/profile
   * @returns {{ nickname, avatar, phone, role, userId }}
   */
  getProfile() {
    return request({ url: '/api/auth/profile', method: 'GET' })
  },

  /**
   * 鎵嬫満鍙风櫥褰?
   * POST /api/auth/login
   * @param {string} phone - 鎵嬫満鍙?
   * @param {string} password  - 瀵嗙爜锛堝綋鍓嶇櫥褰曢〉杈撳叆妗嗘部鐢?code 鍙橀噺鍚嶏級
   * @returns {{ token, userInfo }}
   */
  login(phone, password) {
    return request({ url: '/api/auth/login', method: 'POST', data: { phone, password } })
  },

  /**
   * 鍙戦€侀獙璇佺爜
   * POST /api/auth/send-code
   * @param {string} phone - 鎵嬫満鍙?
   * @returns {{ success: boolean }}
   */
  sendCode(phone) {
    return tryReal(
      () => request({ url: '/api/auth/send-code', method: 'POST', data: { phone } }),
      () => mockResolve({ success: true })
    )
  },

  /**
   * 閫€鍑虹櫥褰?
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
