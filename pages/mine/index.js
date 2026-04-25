const authService = require('../../services/auth')
const productService = require('../../services/product')
const logService = require('../../services/log')
const traceService = require('../../services/trace')

const PRODUCT_PREVIEW_LIMIT = 6
const HISTORY_PREVIEW_LIMIT = 8

const ROLE_TEXT_MAP = {
  admin: '系统管理员',
  manager: '园区管理员',
  farmer: '种植户',
  worker: '农事人员',
  buyer: '采购员',
}

Page({
  data: {
    isLogin: false,

    profileLoading: false,
    profileLoadFailed: false,
    userInfo: {
      nickname: '',
      avatar: '',
      phone: '',
      role: '',
      roleText: '',
    },

    qrcodeLoading: false,
    qrcodeLoadFailed: false,
    qrcodeList: [],
    qrcodeTotal: 0,
    hasMoreQrcode: false,
    batchIds: [],
    batchNameMap: {},
    latestBatchId: '',
    generatingId: '',
    previewingId: '',

    historyLoading: false,
    historyLoadFailed: false,
    historyList: [],
    historyTotal: 0,
    hasMoreHistory: false,
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this._resetLoginState()
      return
    }

    const cached = wx.getStorageSync('userInfo')
    if (cached && typeof cached === 'object') {
      const userInfo = this._normalizeUserInfo(cached)
      this.setData({ isLogin: true, userInfo })
      getApp().globalData.userInfo = userInfo
    } else {
      this.setData({ isLogin: true })
    }

    this.fetchProfile()
    this.refreshWorkbench()
  },

  async onPullDownRefresh() {
    if (!this.data.isLogin) {
      wx.stopPullDownRefresh()
      return
    }

    await Promise.allSettled([
      this.fetchProfile(),
      this.refreshWorkbench(),
    ])
    wx.stopPullDownRefresh()
  },

  async fetchProfile() {
    this.setData({ profileLoading: true, profileLoadFailed: false })

    try {
      const profile = await authService.getProfile()
      const userInfo = this._normalizeUserInfo(profile)
      wx.setStorageSync('userInfo', userInfo)
      getApp().globalData.userInfo = userInfo
      this.setData({
        profileLoading: false,
        profileLoadFailed: false,
        userInfo,
      })
    } catch (err) {
      console.error('用户信息加载失败', err)
      this.setData({
        profileLoading: false,
        profileLoadFailed: true,
      })
    }
  },

  async refreshWorkbench() {
    const { list, batchIds, batchNameMap } = await this.fetchQrcodeList()
    await this.fetchTodayHistory(batchIds, batchNameMap, list)
  },

  async fetchQrcodeList() {
    this.setData({ qrcodeLoading: true, qrcodeLoadFailed: false })

    try {
      const rawList = await productService.getList()
      const list = this._normalizeProductList(rawList)
      const batchIds = this._extractBatchIds(list)
      const batchNameMap = this._buildBatchNameMap(list)

      this.setData({
        qrcodeLoading: false,
        qrcodeLoadFailed: false,
        qrcodeList: list.slice(0, PRODUCT_PREVIEW_LIMIT),
        qrcodeTotal: list.length,
        hasMoreQrcode: list.length > PRODUCT_PREVIEW_LIMIT,
        batchIds,
        batchNameMap,
        latestBatchId: batchIds[0] || '',
      })

      return { list, batchIds, batchNameMap }
    } catch (err) {
      console.error('批次二维码列表加载失败', err)
      this.setData({
        qrcodeLoading: false,
        qrcodeLoadFailed: true,
        qrcodeList: [],
        qrcodeTotal: 0,
        hasMoreQrcode: false,
        batchIds: [],
        batchNameMap: {},
        latestBatchId: '',
      })
      return { list: [], batchIds: [], batchNameMap: {} }
    }
  },

  async fetchTodayHistory(batchIds = [], batchNameMap = {}, products = []) {
    this.setData({ historyLoading: true, historyLoadFailed: false })

    const fallbackBatchIds = Array.isArray(batchIds) && batchIds.length ? batchIds : this._extractBatchIds(products)
    const fallbackMap =
      batchNameMap && Object.keys(batchNameMap).length
        ? batchNameMap
        : this._buildBatchNameMap(products)

    if (!fallbackBatchIds.length) {
      this.setData({
        historyLoading: false,
        historyLoadFailed: false,
        historyList: [],
        historyTotal: 0,
        hasMoreHistory: false,
      })
      return
    }

    try {
      const logs = await logService.getTodayRecords({ batchIds: fallbackBatchIds })
      const records = this._normalizeHistoryList(logs, fallbackMap)

      this.setData({
        historyLoading: false,
        historyLoadFailed: false,
        historyList: records.slice(0, HISTORY_PREVIEW_LIMIT),
        historyTotal: records.length,
        hasMoreHistory: records.length > HISTORY_PREVIEW_LIMIT,
      })
    } catch (err) {
      console.error('今日操作记录加载失败', err)
      this.setData({
        historyLoading: false,
        historyLoadFailed: true,
        historyList: [],
        historyTotal: 0,
        hasMoreHistory: false,
      })
    }
  },

  onRetryProfile() {
    this.fetchProfile()
  },

  async onRetryQrcode() {
    const { batchIds, batchNameMap, list } = await this.fetchQrcodeList()
    await this.fetchTodayHistory(batchIds, batchNameMap, list)
  },

  onRetryHistory() {
    this.fetchTodayHistory(this.data.batchIds, this.data.batchNameMap, this.data.qrcodeList)
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onViewMoreQrcode() {
    wx.navigateTo({ url: '/pages/product-qrcode/index' })
  },

  onViewMoreHistory() {
    const batchId = this._resolveHistoryBatchId()
    if (!batchId) {
      wx.showToast({ title: '暂无更多可查看记录', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/farming-log/index?batchId=${batchId}` })
  },

  async onGenerateQrcode(e) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.generatingId) return

    const item = this._findProductById(id)
    if (!item) return

    const traceCode = this._ensureTraceCode(item)
    const accessUrl = this._buildTraceViewPath(traceCode)
    if (!accessUrl) {
      wx.showToast({ title: '溯源码格式无效', icon: 'none' })
      return
    }

    this.setData({ generatingId: id })
    try {
      const res = await productService.generateQrcode(id, { traceCode, accessUrl })
      const qrcodeImage = String(res.qrcodeImage || item.qrcodeImage || '').trim()
      const qrcodeUrl = String(res.qrcodeUrl || accessUrl).trim()

      this._updateProductById(id, {
        traceCode: String(res.traceCode || traceCode).trim(),
        qrcodeImage,
        qrcodeUrl,
        hasQrcodeImage: Boolean(qrcodeImage || this._isLikelyImageUrl(qrcodeUrl)),
        qrcodeType: res.qrcodeType || 'normal',
        qrcodeFallback: Boolean(res.qrcodeFallback),
        qrcodeFallbackReason: res.qrcodeFallbackReason || '',
        qrcodeGenerated: true,
      })

      wx.showToast({
        title: res.qrcodeType === 'mini_program' ? '小程序码已生成' : '二维码已生成',
        icon: 'success',
      })

      this.fetchTodayHistory(this.data.batchIds, this.data.batchNameMap, this.data.qrcodeList)
    } catch (err) {
      if (!err._toasted) {
        wx.showToast({ title: err.message || '生成失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ generatingId: '' })
    }
  },

  async onPreviewQrcode(e) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.previewingId) return

    const item = this._findProductById(id)
    if (!item || !item.qrcodeGenerated) {
      wx.showToast({ title: '请先生成二维码', icon: 'none' })
      return
    }

    this.setData({ previewingId: id })
    try {
      const ensured = await this._ensureQrcodeAsset(item)
      const filePath = await this._resolveQrcodeTempFile(ensured)
      wx.previewImage({ urls: [filePath], current: filePath })
    } catch (err) {
      wx.showToast({ title: err.message || '二维码预览失败', icon: 'none' })
    } finally {
      this.setData({ previewingId: '' })
    }
  },

  onCopyTraceCode(e) {
    const traceCode = String(e.currentTarget.dataset.code || '').trim()
    if (!traceCode) {
      wx.showToast({ title: '暂无可复制溯源码', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: traceCode,
      success: () => wx.showToast({ title: '溯源码已复制', icon: 'success' }),
    })
  },

  onViewTrace(e) {
    const traceCode = String(e.currentTarget.dataset.code || '').trim()
    const tracePath = this._buildTraceViewPath(traceCode)
    if (!tracePath) {
      wx.showToast({ title: '暂无可查看的溯源码', icon: 'none' })
      return
    }
    wx.navigateTo({ url: tracePath })
  },

  async onLogout() {
    const res = await new Promise((resolve) => {
      wx.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: resolve,
      })
    })
    if (!res.confirm) return

    try {
      await authService.logout()
      wx.removeStorageSync('token')
      wx.removeStorageSync('userInfo')
      getApp().globalData.userInfo = null
      this._resetLoginState()
      wx.showToast({ title: '已退出登录', icon: 'none' })
    } catch (err) {
      if (!err._toasted) wx.showToast({ title: '退出失败', icon: 'none' })
    }
  },

  _resetLoginState() {
    this.setData({
      isLogin: false,
      profileLoading: false,
      profileLoadFailed: false,
      userInfo: {
        nickname: '',
        avatar: '',
        phone: '',
        role: '',
        roleText: '',
      },
      qrcodeLoading: false,
      qrcodeLoadFailed: false,
      qrcodeList: [],
      qrcodeTotal: 0,
      hasMoreQrcode: false,
      batchIds: [],
      batchNameMap: {},
      latestBatchId: '',
      generatingId: '',
      previewingId: '',
      historyLoading: false,
      historyLoadFailed: false,
      historyList: [],
      historyTotal: 0,
      hasMoreHistory: false,
    })
  },

  _normalizeUserInfo(raw = {}) {
    const role = String(raw.role || '').trim()
    const roleText = ROLE_TEXT_MAP[role] || role || '未设置角色'

    return {
      ...raw,
      nickname: raw.nickname || '用户',
      avatar: raw.avatar || '',
      phone: raw.phone || '',
      role,
      roleText: `角色：${roleText}`,
    }
  },

  _normalizeProductList(rawList) {
    const rows = Array.isArray(rawList) ? rawList : []
    const list = rows.map((item, index) => {
      const row = item && typeof item === 'object' ? item : {}
      const id = row.id !== undefined && row.id !== null ? row.id : `tmp-${index}`
      const batchId = Number(row.batchId)
      const normalizedBatchId = Number.isFinite(batchId) && batchId > 0 ? batchId : null
      const traceCode = String(row.traceCode || '').trim()
      const qrcodeImage = String(row.qrcodeImage || '').trim()
      const qrcodeUrl = String(row.qrcodeUrl || '').trim()
      const qrcodeGenerated = Boolean(row.qrcodeGenerated || qrcodeImage || qrcodeUrl)
      const hasQrcodeImage = Boolean(
        row.hasQrcodeImage || qrcodeImage || this._isLikelyImageUrl(qrcodeUrl),
      )

      return {
        ...row,
        id,
        batchId: normalizedBatchId,
        batchName: row.batchName || row.batchNo || '--',
        variety: row.variety || '--',
        grade: row.grade || '--',
        status: row.status || '--',
        traceCode,
        qrcodeImage,
        qrcodeUrl,
        qrcodeGenerated,
        hasQrcodeImage,
        sortTime: this._resolveTimestamp(row.updatedAt || row.createdAt || row.time),
      }
    })

    list.sort((a, b) => {
      const generatedDiff = Number(b.qrcodeGenerated) - Number(a.qrcodeGenerated)
      if (generatedDiff) return generatedDiff

      const timeDiff = (b.sortTime || 0) - (a.sortTime || 0)
      if (timeDiff) return timeDiff

      return Number(b.id || 0) - Number(a.id || 0)
    })

    return list
  },

  _normalizeHistoryList(rawList, batchNameMap = {}) {
    const rows = Array.isArray(rawList) ? rawList : []
    const map = batchNameMap && typeof batchNameMap === 'object' ? batchNameMap : {}

    const list = rows.map((item, index) => {
      const row = item && typeof item === 'object' ? item : {}
      const batchIdRaw = Number(row.batchId ?? row.batch_id)
      const batchId = Number.isFinite(batchIdRaw) && batchIdRaw > 0 ? batchIdRaw : null
      const timestamp = this._resolveTimestamp(
        row.operationDate || row.createdAt || row.displayTime || row.time || row.date,
      )

      const displayTime = row.displayTime
        || row.time
        || this._formatDateTime(row.operationDate || row.createdAt || row.date)
        || '--'
      const displayType = row.typeText || row.type || '操作'
      const displayContent = row.displayContent || row.content || row.title || '暂无操作摘要'
      const batchName = row.batchName || row.batchNo || (batchId ? map[String(batchId)] || '' : '')

      return {
        ...row,
        batchId,
        batchName,
        displayTime,
        displayType,
        displayContent,
        timestamp,
        historyKey: `${row.id || 'log'}-${batchId || 'x'}-${index}`,
      }
    })

    list.sort((a, b) => {
      const diff = (b.timestamp || 0) - (a.timestamp || 0)
      if (diff) return diff
      return Number(b.id || 0) - Number(a.id || 0)
    })

    return list
  },

  _buildBatchNameMap(products = []) {
    const map = {}
    const rows = Array.isArray(products) ? products : []
    rows.forEach((item) => {
      if (!item || !item.batchId) return
      const key = String(item.batchId)
      if (map[key]) return
      map[key] = item.batchName || `批次 ${item.batchId}`
    })
    return map
  },

  _extractBatchIds(products = []) {
    const rows = Array.isArray(products) ? products : []
    const seen = new Set()
    const result = []

    rows.forEach((item) => {
      const batchId = Number(item && item.batchId)
      if (!Number.isFinite(batchId) || batchId <= 0 || seen.has(batchId)) return
      seen.add(batchId)
      result.push(batchId)
    })

    return result
  },

  _resolveHistoryBatchId() {
    const firstHistory = this.data.historyList.find((item) => item && item.batchId)
    if (firstHistory && firstHistory.batchId) return firstHistory.batchId

    if (Array.isArray(this.data.batchIds) && this.data.batchIds.length > 0) {
      return this.data.batchIds[0]
    }

    return this.data.latestBatchId || ''
  },

  _findProductById(id) {
    return this.data.qrcodeList.find((item) => String(item.id) === String(id))
  },

  _updateProductById(id, patch = {}) {
    const rows = Array.isArray(this.data.qrcodeList) ? this.data.qrcodeList : []
    const qrcodeList = rows.map((item) =>
      String(item.id) === String(id) ? { ...item, ...patch } : item,
    )
    this.setData({ qrcodeList })
  },

  _ensureTraceCode(product) {
    const current = String((product && product.traceCode) || '').trim()
    if (current) return current

    const productId = (product && product.id) || 'X'
    const batchId = (product && product.batchId) || 'X'
    return `P${productId}-B${batchId}`
  },

  async _ensureQrcodeAsset(product) {
    if (!product || !product.qrcodeGenerated) {
      throw new Error('请先生成二维码')
    }

    if (product.hasQrcodeImage) {
      return product
    }

    const traceCode = this._ensureTraceCode(product)
    const accessUrl = this._buildTraceViewPath(traceCode)
    if (!accessUrl) {
      throw new Error('溯源码格式无效')
    }

    const res = await productService.generateQrcode(product.id, { traceCode, accessUrl })
    const qrcodeImage = String(res.qrcodeImage || '').trim()
    const qrcodeUrl = String(res.qrcodeUrl || accessUrl).trim()
    const patch = {
      traceCode: String(res.traceCode || traceCode).trim(),
      qrcodeImage,
      qrcodeUrl,
      hasQrcodeImage: Boolean(qrcodeImage || this._isLikelyImageUrl(qrcodeUrl)),
      qrcodeType: res.qrcodeType || 'normal',
      qrcodeFallback: Boolean(res.qrcodeFallback),
      qrcodeFallbackReason: res.qrcodeFallbackReason || '',
      qrcodeGenerated: true,
    }

    this._updateProductById(product.id, patch)
    return { ...product, ...patch }
  },

  _resolveTimestamp(value) {
    if (!value) return 0
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime()

    const text = String(value).trim()
    if (!text) return 0

    let timestamp = new Date(text.includes('T') ? text : text.replace(/-/g, '/')).getTime()
    if (!Number.isFinite(timestamp) || Number.isNaN(timestamp)) {
      timestamp = new Date(text).getTime()
    }
    return Number.isFinite(timestamp) ? timestamp : 0
  },

  _formatDateTime(value) {
    const timestamp = this._resolveTimestamp(value)
    if (!timestamp) return ''

    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = this._pad(date.getMonth() + 1)
    const day = this._pad(date.getDate())
    const hour = this._pad(date.getHours())
    const minute = this._pad(date.getMinutes())
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  _pad(num) {
    return String(num).padStart(2, '0')
  },

  _buildTraceViewPath(traceCode) {
    return traceService.buildTraceViewPath(traceCode)
  },

  _resolveQrcodeSource(product) {
    const qrcodeImage = String((product && product.qrcodeImage) || '').trim()
    if (qrcodeImage) return qrcodeImage

    const qrcodeUrl = String((product && product.qrcodeUrl) || '').trim()
    if (this._isLikelyImageUrl(qrcodeUrl)) return qrcodeUrl

    return ''
  },

  _isLikelyImageUrl(url) {
    const value = String(url || '').trim()
    if (!value) return false

    if (value.startsWith('data:image/')) return true
    if (value.startsWith('wxfile://')) return true
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?.*)?$/i.test(value)
    }

    return /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?.*)?$/i.test(value)
  },

  async _resolveQrcodeTempFile(product) {
    const source = this._resolveQrcodeSource(product)
    if (!source) {
      throw new Error('二维码图片不可用，请重新生成')
    }

    if (source.startsWith('wxfile://')) {
      return source
    }

    if (source.startsWith('data:image/')) {
      const fileName = `mine-trace-${product.id || 'code'}-${Date.now()}`
      return this._writeBase64Image(source, fileName)
    }

    if (source.startsWith('http://') || source.startsWith('https://')) {
      return this._downloadImage(source)
    }

    return source
  },

  _downloadImage(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
            resolve(res.tempFilePath)
            return
          }
          reject(new Error('二维码下载失败'))
        },
        fail: (err) => {
          reject(err || new Error('二维码下载失败'))
        },
      })
    })
  },

  _writeBase64Image(dataUri, fileName) {
    const match = String(dataUri || '').match(/^data:image\/(\w+);base64,(.+)$/i)
    if (!match) {
      return Promise.reject(new Error('二维码图片格式不支持'))
    }

    const ext = match[1] || 'png'
    const content = match[2] || ''
    const fs = wx.getFileSystemManager()
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.${ext}`

    return new Promise((resolve, reject) => {
      fs.writeFile({
        filePath,
        data: content,
        encoding: 'base64',
        success: () => resolve(filePath),
        fail: (err) => reject(err || new Error('二维码写入失败')),
      })
    })
  },
})

