const logService = require('../../services/log')
const batchService = require('../../services/batch')
const { uploadImage } = require('../../services/upload')

Page({
  data: {
    batches: [],
    batchIndex: -1,

    loadingInit: true,
    loadInitFailed: false,

    logTypes: [],
    typeIndex: -1,
    description: '',
    fileList: [],
    imagePath: '',

    submitting: false
  },

  onLoad(options) {
    this._preselectedBatchId = options.batchId || ''
    this._loadInitData()
  },

  async _loadInitData() {
    this.setData({ loadingInit: true, loadInitFailed: false })
    try {
      const [types, batchList] = await Promise.all([
        logService.getTypes(),
        batchService.getList()
      ])
      const logTypes = (types || []).filter(t => t.value !== 'all')
      const batches = batchList || []

      let batchIndex = -1
      if (this._preselectedBatchId) {
        batchIndex = batches.findIndex(
          b => String(b.id) === String(this._preselectedBatchId)
        )
      }

      this.setData({ logTypes, batches, batchIndex, loadingInit: false })
    } catch (err) {
      console.error('初始化数据加载失败', err)
      this.setData({ loadingInit: false, loadInitFailed: true })
    }
  },

  onRetryLoad() {
    this._loadInitData()
  },

  /* ---------- 表单字段 ---------- */

  onFieldChange(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail })
  },

  onBatchChange(e) {
    this.setData({ batchIndex: Number(e.detail.value) })
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) })
  },

  /* ---------- 图片选择 ---------- */

  onAfterRead(e) {
    const { file } = e.detail
    this.setData({
      fileList: [{ url: file.url }],
      imagePath: file.url
    })
  },

  onDeleteImage() {
    this.setData({ fileList: [], imagePath: '' })
  },

  /* ---------- 校验 ---------- */

  _validate() {
    const { batchIndex, typeIndex, description } = this.data
    if (batchIndex < 0) return '请选择关联批次'
    if (typeIndex < 0) return '请选择日志类型'
    if (!description.trim()) return '请填写日志描述'
    return ''
  },

  /* ---------- 提交 ---------- */

  async onSubmit() {
    if (this.data.submitting) return

    const errMsg = this._validate()
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' })
      return
    }

    const { batches, batchIndex, logTypes, typeIndex, description, imagePath } = this.data
    const batchId = String(batches[batchIndex].id)
    this.setData({ submitting: true })

    try {
      let imageUrl = ''
      if (imagePath) {
        const uploadRes = await uploadImage(imagePath)
        imageUrl = uploadRes.url || uploadRes || ''
      }

      await logService.create({
        batchId,
        type: logTypes[typeIndex].value,
        description: description.trim(),
        image_url: imageUrl,
        source: 'manual'
      })

      wx.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => {
        const pages = getCurrentPages()
        const prevPage = pages[pages.length - 2]
        if (prevPage && prevPage.fetchData) {
          prevPage.fetchData(batchId)
        }
        wx.navigateBack()
      }, 800)
    } catch (err) {
      if (!err._toasted) {
        wx.showToast({ title: err.message || '提交失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ submitting: false })
    }
  }
})
