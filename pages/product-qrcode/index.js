const productService = require('../../services/product')
const traceService = require('../../services/trace')

Page({
  data: {
    loading: true,
    loadFailed: false,
    products: [],
    generatingId: '',
    savingId: '',
    scanning: false,
  },

  onLoad() {
    this.fetchList()
  },

  async fetchList() {
    this.setData({ loading: true, loadFailed: false })
    try {
      const list = await productService.getList()
      const products = Array.isArray(list) ? list : []
      this.setData({ products, loading: false })
    } catch (err) {
      console.error('产品列表加载失败', err)
      this.setData({ loading: false, loadFailed: true })
    }
  },

  onRetry() {
    this.fetchList()
  },

  async onPullDownRefresh() {
    await this.fetchList()
    wx.stopPullDownRefresh()
  },

  async onGenerateQrcode(e) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.generatingId) return

    const product = this._findProduct(id)
    if (!product) return

    const traceCode = this._ensureTraceCode(product)
    const accessUrl = traceService.buildTraceViewPath(traceCode)
    if (!accessUrl) {
      wx.showToast({ title: '溯源码格式无效', icon: 'none' })
      return
    }

    this.setData({ generatingId: id })

    try {
      const res = await productService.generateQrcode(id, { traceCode, accessUrl })
      const qrcodeImage = res.qrcodeImage || product.qrcodeImage || ''
      const qrcodeUrl = res.qrcodeUrl || accessUrl
      this._updateProduct(id, {
        traceCode: res.traceCode || traceCode,
        qrcodeImage,
        qrcodeUrl,
        hasQrcodeImage: Boolean(qrcodeImage || this._isLikelyImageUrl(qrcodeUrl)),
        qrcodeType: res.qrcodeType || 'normal',
        qrcodeFallback: Boolean(res.qrcodeFallback),
        qrcodeFallbackReason: res.qrcodeFallbackReason || '',
        qrcodeGenerated: true,
      })
      const useMiniProgramCode = res.qrcodeType === 'mini_program'
      wx.showToast({
        title: useMiniProgramCode ? '小程序码已生成' : '普通二维码已生成',
        icon: 'success',
      })
    } catch (err) {
      if (!err._toasted) {
        wx.showToast({ title: err.message || '生成失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ generatingId: '' })
    }
  },

  async onViewQrcode(e) {
    const id = e.currentTarget.dataset.id
    const product = this._findProduct(id)

    if (!product || !product.qrcodeGenerated) {
      wx.showToast({ title: '请先生成二维码', icon: 'none' })
      return
    }

    try {
      const filePath = await this._resolveQrcodeTempFile(product)
      wx.previewImage({ urls: [filePath], current: filePath })
    } catch (err) {
      wx.showToast({ title: err.message || '二维码预览失败', icon: 'none' })
    }
  },

  async onSaveQrcode(e) {
    const id = e.currentTarget.dataset.id
    const product = this._findProduct(id)

    if (!product || !product.qrcodeGenerated) {
      wx.showToast({ title: '请先生成二维码', icon: 'none' })
      return
    }

    if (this.data.savingId) return
    this.setData({ savingId: id })

    try {
      const filePath = await this._resolveQrcodeTempFile(product)
      await this._saveImageToAlbum(filePath)
      wx.showToast({ title: '二维码已保存', icon: 'success' })
    } catch (err) {
      const message = String((err && err.errMsg) || err.message || '')
      if (message.includes('auth deny') || message.includes('auth denied')) {
        wx.showToast({ title: '请先开启相册权限', icon: 'none' })
      } else {
        wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ savingId: '' })
    }
  },

  onViewTrace(e) {
    const id = e.currentTarget.dataset.id
    const product = this._findProduct(id)
    const traceCode = String((product && product.traceCode) || '').trim()

    if (!traceCode) {
      wx.showToast({ title: '请先生成溯源码', icon: 'none' })
      return
    }

    const tracePath = traceService.buildTraceViewPath(traceCode)
    if (!tracePath) {
      wx.showToast({ title: '溯源码格式无效', icon: 'none' })
      return
    }

    wx.navigateTo({ url: tracePath })
  },

  onCopyTraceCode(e) {
    const traceCode = String((e.currentTarget.dataset.code) || '').trim()
    if (!traceCode) {
      wx.showToast({ title: '暂无可复制溯源码', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: traceCode,
      success: () => wx.showToast({ title: '溯源码已复制', icon: 'success' }),
    })
  },

  onScanTraceCode() {
    if (this.data.scanning) return

    this.setData({ scanning: true })
    wx.scanCode({
      scanType: ['qrCode'],
      success: (res) => {
        const traceCode = traceService.extractTraceCode(res.result)
        if (!traceCode) {
          wx.showToast({ title: '未识别到有效溯源码', icon: 'none' })
          return
        }

        const tracePath = traceService.buildTraceViewPath(traceCode)
        if (!tracePath) {
          wx.showToast({ title: '未识别到有效溯源码', icon: 'none' })
          return
        }

        wx.navigateTo({ url: tracePath })
      },
      fail: (err) => {
        const errMsg = String((err && err.errMsg) || '')
        if (errMsg.toLowerCase().includes('cancel')) {
          return
        }
        wx.showToast({ title: '扫码失败，请重试', icon: 'none' })
      },
      complete: () => {
        this.setData({ scanning: false })
      },
    })
  },

  _findProduct(id) {
    return this.data.products.find((item) => String(item.id) === String(id))
  },

  _updateProduct(id, patch) {
    const products = this.data.products.map((item) =>
      String(item.id) === String(id) ? { ...item, ...patch } : item,
    )
    this.setData({ products })
  },

  _ensureTraceCode(product) {
    const current = String((product && product.traceCode) || '').trim()
    if (current) return current

    const productId = (product && product.id) || 'X'
    const batchId = (product && product.batchId) || 'X'
    const suffix = Date.now().toString(36).toUpperCase().slice(-6)
    return `P${productId}-B${batchId}-${suffix}`
  },

  _resolveQrcodeSource(product) {
    const qrcodeImage = String((product && product.qrcodeImage) || '').trim()
    if (qrcodeImage) return qrcodeImage

    const qrcodeUrl = String((product && product.qrcodeUrl) || '').trim()
    if (this._isLikelyImageUrl(qrcodeUrl)) {
      return qrcodeUrl
    }

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
      const fileName = `trace-${product.id || 'code'}-${Date.now()}`
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

  _saveImageToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: reject,
      })
    })
  },
})
