const authService = require('../../services/auth')
const config = require('../../services/config')

let timer = null

Page({
  data: {
    phone: '',
    code: '',
    countdown: 0,
    logging: false,
    canLogin: false,
    isDev: false
  },

  onLoad() {
    this.setData({ isDev: config.ENV === 'dev' })
  },

  onUnload() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  },

  onPhoneChange(e) {
    this.setData({ phone: e.detail })
    this._checkCanLogin()
  },

  onCodeChange(e) {
    this.setData({ code: e.detail })
    this._checkCanLogin()
  },

  _checkCanLogin() {
    const { phone, code } = this.data
    this.setData({ canLogin: phone.length === 11 && code.length === 6 })
  },

  async onSendCode() {
    const { phone, countdown } = this.data
    if (countdown > 0) return

    if (phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    try {
      await authService.sendCode(phone)
      wx.showToast({ title: '验证码已发送', icon: 'none' })

      this.setData({ countdown: 60 })
      timer = setInterval(() => {
        const c = this.data.countdown - 1
        this.setData({ countdown: c })
        if (c <= 0) {
          clearInterval(timer)
          timer = null
        }
      }, 1000)
    } catch (err) {
      if (!err._toasted) wx.showToast({ title: err.message || '发送失败', icon: 'none' })
    }
  },

  onQuickLogin() {
    this.setData({ phone: '13800000000', code: '123456', canLogin: true })
    this.onLogin()
  },

  async onLogin() {
    const { phone, code, logging } = this.data
    if (logging) return

    this.setData({ logging: true })
    try {
      const res = await authService.login(phone, code)
      authService.saveSession(res && res.token, null)

      // 登录成功后再拉取一次 profile，确保页面展示和后端真实数据一致
      let profile = null
      try {
        profile = await authService.getProfile()
      } catch (e) {
        profile = (res && res.userInfo) || null
      }

      authService.saveSession(res && res.token, profile)
      getApp().globalData.userInfo = profile

      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/mine/index' })
      }, 800)
    } catch (err) {
      if (!err._toasted) wx.showToast({ title: err.message || '登录失败', icon: 'none' })
    } finally {
      this.setData({ logging: false })
    }
  }
})
