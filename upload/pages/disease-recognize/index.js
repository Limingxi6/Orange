const diseaseService = require('../../services/disease')
const logService = require('../../services/log')
const batchService = require('../../services/batch')

const RECENT_BATCH_KEY = 'recentBatchId'

const SEVERITY_MAP = {
  high: { type: 'danger', color: '#ee0a24', text: '高' },
  mid: { type: 'warning', color: '#ff976a', text: '中' },
  low: { type: 'success', color: '#07c160', text: '低' },
  高: { type: 'danger', color: '#ee0a24', text: '高' },
  中: { type: 'warning', color: '#ff976a', text: '中' },
  低: { type: 'success', color: '#07c160', text: '低' }
}

function getSeverityConfig(severity) {
  return SEVERITY_MAP[severity] || SEVERITY_MAP.low
}

Page({
  data: {
    batchId: '',
    batches: [],
    batchIndex: -1,
    batchLoading: false,
    batchLoadFailed: false,

    fileList: [],
    imagePath: '',

    recognizing: false,
    showResult: false,
    recognizeFailed: false,

    result: null,
    confidencePercent: '',
    severityTag: 'warning',
    severityText: '低',
    saving: false,
    saved: false
  },

  onLoad(options) {
    const batchId = this._resolveBatchId(options)
    this._initialBatchId = batchId
    if (batchId) {
      this.setData({ batchId })
      this._rememberBatchId(batchId)
    }
    this._loadBatches()
  },

  async _loadBatches() {
    this.setData({ batchLoading: true, batchLoadFailed: false })
    try {
      const list = await batchService.getList({ page: 1, limit: 100, sort: 'latest' })
      const batches = Array.isArray(list) ? list : []
      const selectedId = this._normalizeBatchId(this.data.batchId || this._initialBatchId)
      const batchIndex = selectedId
        ? batches.findIndex((item) => String(item.id) === selectedId)
        : -1

      this.setData({
        batches,
        batchIndex,
        batchId: batchIndex >= 0 ? String(batches[batchIndex].id) : '',
        batchLoading: false
      })
    } catch (err) {
      console.error('加载批次失败', err)
      this.setData({
        batchLoading: false,
        batchLoadFailed: true,
        batches: [],
        batchIndex: -1
      })
    }
  },

  onRetryLoadBatches() {
    this._loadBatches()
  },

  onBatchChange(e) {
    const index = Number(e.detail.value)
    const target = this.data.batches[index]
    const batchId = this._normalizeBatchId(target && target.id)

    this.setData({
      batchIndex: index,
      batchId,
      saved: false
    })
    this._rememberBatchId(batchId)
  },

  onAfterRead(e) {
    const { file } = e.detail
    this.setData({
      fileList: [{ url: file.url }],
      imagePath: file.url,
      showResult: false,
      recognizeFailed: false,
      result: null,
      saved: false
    })
  },

  onDeleteImage() {
    this.setData({
      fileList: [],
      imagePath: '',
      showResult: false,
      recognizeFailed: false,
      result: null,
      saved: false
    })
  },

  async onRecognize() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }
    this.setData({ recognizing: true, showResult: false, recognizeFailed: false })

    try {
      const result = await diseaseService.predict(this.data.imagePath, this.data.batchId)
      const severityCfg = getSeverityConfig(result.severity)
      const confidence = Number(result.confidence)
      const confidencePercent = Number.isFinite(confidence)
        ? (confidence <= 1 ? confidence * 100 : confidence).toFixed(1) + '%'
        : '--'

      this.setData({
        result,
        confidencePercent,
        severityTag: severityCfg.type,
        severityText: result.severityText || severityCfg.text,
        showResult: true,
        saved: false
      })
    } catch (err) {
      this.setData({ recognizeFailed: true })
      if (!err._toasted) wx.showToast({ title: err.message || '识别失败，请重试', icon: 'none' })
    } finally {
      this.setData({ recognizing: false })
    }
  },

  async onSaveLog() {
    const { result, showResult, saving, saved, batchId, severityText } = this.data
    if (!showResult || !result) {
      wx.showToast({ title: '请先完成识别', icon: 'none' })
      return
    }

    const normalizedBatchId = this._normalizeBatchId(batchId)
    if (!normalizedBatchId) {
      wx.showToast({ title: '请先选择关联批次后再保存日志', icon: 'none' })
      return
    }

    if (saving || saved) return

    this.setData({ saving: true })
    try {
      const serverImageUrl = result.image_url || result.imageUrl || ''
      await logService.create({
        batchId: normalizedBatchId,
        type: '识别',
        description: `${result.label}（置信度 ${this.data.confidencePercent}，${severityText}级）\n${result.advice}`,
        image_url: serverImageUrl,
        source: 'disease_recognize'
      })
      this._rememberBatchId(normalizedBatchId)
      this.setData({ saved: true })
      wx.showToast({ title: '已保存为农事日志', icon: 'success' })
    } catch (err) {
      if (!err._toasted) wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  _resolveBatchId(options = {}) {
    const fromOptions = this._normalizeBatchId(options.batchId)
    if (fromOptions) return fromOptions

    const app = getApp()
    const fromGlobal = this._normalizeBatchId(app && app.globalData ? app.globalData.recentBatchId : '')
    if (fromGlobal) return fromGlobal

    const fromStorage = this._normalizeBatchId(wx.getStorageSync(RECENT_BATCH_KEY))
    return fromStorage || ''
  },

  _normalizeBatchId(value) {
    const id = Number(value)
    return Number.isFinite(id) && id > 0 ? String(id) : ''
  },

  _rememberBatchId(batchId) {
    const id = this._normalizeBatchId(batchId)
    if (!id) return

    const app = getApp()
    if (app && app.globalData) {
      app.globalData.recentBatchId = id
    }
    wx.setStorageSync(RECENT_BATCH_KEY, id)
  }
})
