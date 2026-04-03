const authService = require('../../services/auth')

Page({
  data: {
    isLogin: false,
    loading: true,
    loadFailed: false,
    userInfo: { nickname: '', avatar: '' },
    menuList: [
      { id: 'batch', name: '我的批次', path: '/pages/batch-list/index' },
      { id: 'product', name: '我的产品', path: '/pages/product-qrcode/index' },
      { id: 'trace', name: '扫码溯源', path: '/pages/trace-view/index' },
      { id: 'about', name: '关于我们', path: '' }
    ]
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (token) {
      const cached = wx.getStorageSync('userInfo')
      if (cached && cached.nickname) {
        this.setData({ isLogin: true, userInfo: cached, loading: false })
        getApp().globalData.userInfo = cached
      } else {
        this.setData({ isLogin: true })
      }
      this.fetchProfile()
    } else {
      this.setData({ isLogin: false, loading: false, userInfo: { nickname: '', avatar: '' } })
    }
  },

  async fetchProfile() {
    this.setData({ loadFailed: false })
    try {
      const userInfo = await authService.getProfile()
      wx.setStorageSync('userInfo', userInfo)
      this.setData({ userInfo, loading: false })
      getApp().globalData.userInfo = userInfo
    } catch (err) {
      console.error('用户信息加载失败', err)
      if (!this.data.userInfo.nickname) {
        this.setData({ loading: false, loadFailed: true })
      } else {
        this.setData({ loading: false })
      }
    }
  },

  onRetry() {
    this.fetchProfile()
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onMenuTap(e) {
    const { path, id } = e.currentTarget.dataset
    if (!this.data.isLogin) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    if (path) {
      wx.navigateTo({ url: path })
    } else if (id === 'about') {
      wx.showToast({ title: '敬请期待', icon: 'none' })
    }
  },

  async onLogout() {
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: resolve
      })
    })
    if (res.confirm) {
      try {
        await authService.logout()
        wx.removeStorageSync('token')
        wx.removeStorageSync('userInfo')
        getApp().globalData.userInfo = null
        this.setData({
          isLogin: false,
          userInfo: { nickname: '', avatar: '' }
        })
        wx.showToast({ title: '已退出', icon: 'none' })
      } catch (err) {
        if (!err._toasted) wx.showToast({ title: '退出失败', icon: 'none' })
      }
    }
  }
})
