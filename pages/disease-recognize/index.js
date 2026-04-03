const diseaseService = require('../../services/disease')
const logService = require('../../services/log')

const SEVERITY_MAP = {
  '高': { type: 'danger', color: '#ee0a24' },
  '中': { type: 'warning', color: '#ff976a' },
  '低': { type: 'success', color: '#07c160' }
}

Page({
  data: {
    batchId: '',
    fileList: [],
    imagePath: '',

    recognizing: false,
    showResult: false,
    recognizeFailed: false,

    result: null,
    confidencePercent: '',
    severityTag: 'warning',
    saving: false,
    saved: false
  },

  onLoad(options) {
    if (options.batchId) {
      this.setData({ batchId: options.batchId })
    }
  },

  /* ---------- 图片选择 ---------- */

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

  /* ---------- 识别 ---------- */

  async onRecognize() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }
    this.setData({ recognizing: true, showResult: false, recognizeFailed: false })

    try {
      const result = await diseaseService.predict(this.data.imagePath, this.data.batchId)

      const severityCfg = SEVERITY_MAP[result.severity] || SEVERITY_MAP['低']
      this.setData({
        result,
        confidencePercent: (result.confidence * 100).toFixed(1) + '%',
        severityTag: severityCfg.type,
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

  /* ---------- 保存为农事日志 ---------- */

  async onSaveLog() {
    const { result, imagePath, showResult, saving, saved, batchId } = this.data
    if (!showResult || !result) {
      wx.showToast({ title: '请先完成识别', icon: 'none' })
      return
    }
    if (saving || saved) return

    this.setData({ saving: true })
    try {
      const serverImageUrl = result.image_url || result.imageUrl || ''
      await logService.create({
        batchId,
        type: '识别',
        description: `${result.label}（置信度 ${(result.confidence * 100).toFixed(1)}%，${result.severity}级）\n${result.advice}`,
        image_url: serverImageUrl,
        source: 'disease_recognize'
      })
      this.setData({ saved: true })
      wx.showToast({ title: '已保存为农事日志', icon: 'success' })
    } catch (err) {
      if (!err._toasted) wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
