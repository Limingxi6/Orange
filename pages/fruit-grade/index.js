const priceService = require('../../services/price')

const CHANNEL_OPTIONS = ['电商', '批发', '摆摊']
const PACKAGE_OPTIONS = ['简装', '礼盒']
const REGION_OPTIONS = ['湖北宜昌', '湖南常德', '江西赣州', '广西桂林', '四川眉山']

function normalizeDefectRatio(raw) {
  if (raw == null) return 0
  return raw >= 1 ? Math.round(raw) : Math.round(raw * 100)
}

function buildScores(r) {
  if (!r) return []
  return [
    { label: '色泽评分', value: r.colorScore ?? 0, color: '' },
    { label: '缺陷率', value: normalizeDefectRatio(r.defectRatio), color: 'defect', suffix: '%' },
    { label: '果径评分', value: r.sizeScore ?? 0, color: '' },
    { label: '成熟度', value: r.maturityScore ?? 0, color: '' }
  ]
}

Page({
  data: {
    fileList: [],
    imagePath: '',

    channel: '电商',
    packaging: '简装',
    region: '湖北宜昌',

    channelColumns: CHANNEL_OPTIONS,
    packageColumns: PACKAGE_OPTIONS,
    regionColumns: REGION_OPTIONS,

    showChannelPicker: false,
    showPackagePicker: false,
    showRegionPicker: false,

    grading: false,
    showResult: false,
    gradeFailed: false,
    result: null,
    scores: [],

    baseline: null
  },

  /* ========== 图片 ========== */

  onAfterRead(e) {
    const { file } = e.detail
    this.setData({
      fileList: [{ url: file.url }],
      imagePath: file.url,
      showResult: false,
      gradeFailed: false,
      result: null,
      scores: [],
      baseline: null
    })
  },

  onDeleteImage() {
    this.setData({
      fileList: [],
      imagePath: '',
      showResult: false,
      gradeFailed: false,
      result: null,
      scores: [],
      baseline: null
    })
  },

  /* ========== Picker 开关 ========== */

  onShowChannelPicker() { this.setData({ showChannelPicker: true }) },
  onCloseChannelPicker() { this.setData({ showChannelPicker: false }) },
  onConfirmChannel(e) {
    this.setData({ channel: e.detail.value, showChannelPicker: false })
  },

  onShowPackagePicker() { this.setData({ showPackagePicker: true }) },
  onClosePackagePicker() { this.setData({ showPackagePicker: false }) },
  onConfirmPackage(e) {
    this.setData({ packaging: e.detail.value, showPackagePicker: false })
  },

  onShowRegionPicker() { this.setData({ showRegionPicker: true }) },
  onCloseRegionPicker() { this.setData({ showRegionPicker: false }) },
  onConfirmRegion(e) {
    this.setData({ region: e.detail.value, showRegionPicker: false })
  },

  /* ========== 分级 ========== */

  async onStartGrade() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '请先选择果实照片', icon: 'none' })
      return
    }
    if (this.data.grading) return

    this.setData({ grading: true, showResult: false, gradeFailed: false })

    try {
      const result = await priceService.gradeAndPrice(this.data.imagePath, {
        channel: this.data.channel,
        packageType: this.data.packaging,
        region: this.data.region
      })

      this.setData({
        result,
        scores: buildScores(result),
        showResult: true
      })

      this._fetchBaseline(result.variety)
    } catch (err) {
      this.setData({ gradeFailed: true })
      if (!err._toasted) {
        wx.showToast({ title: err.message || '分级失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ grading: false })
    }
  },

  /* ========== 基准价（非阻塞，分级成功后附加查询） ========== */

  async _fetchBaseline(variety) {
    try {
      const baseline = await priceService.getBaseline(variety, this.data.region)
      if (baseline) this.setData({ baseline })
    } catch (e) {
      console.warn('基准价查询失败（不影响分级结果）', e)
    }
  }
})
