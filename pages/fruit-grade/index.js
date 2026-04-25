const priceService = require('../../services/price')

const CHANNEL_OPTIONS = ['电商', '批发', '摆摊']
const PACKAGE_OPTIONS = ['简装', '礼盒']
const REGION_OPTIONS = ['湖北宜昌', '湖南常德', '江西赣州', '广西桂林', '四川眉山']
const DEFECT_OPTIONS = ['低', '中', '高']

const DEFECT_LEVEL_LABEL_TO_CODE = {
  低: 'low',
  中: 'mid',
  高: 'high'
}

const DEFECT_LEVEL_CODE_TO_LABEL = {
  low: '低',
  mid: '中',
  high: '高'
}

const SOURCE_ENGINE_LABELS = {
  'python-ai': 'AI',
  'local-rule': '本地规则',
  'fallback-default': '默认兜底'
}

const SOURCE_DECISION_LABELS = {
  'rule-engine': '规则引擎',
  'trained-tabular-model': '训练表格模型',
  'local-rules': '本地规则'
}

const MODEL_VERSION_LABELS = {
  'fruit-perception-v1': '果实感知-v1',
  'local-perception-rule-v1': '本地感知规则-v1',
  'fallback-default-v1': '默认兜底-v1'
}

function localizeText(raw) {
  if (typeof raw !== 'string' || !raw) return raw
  return raw
    .replace(/python[- ]ai/gi, 'AI')
    .replace(/local-rules\+grade-model/gi, '本地规则+分级模型')
    .replace(/local-rules/gi, '本地规则')
    .replace(/local-rule/gi, '本地规则')
    .replace(/fallback-default/gi, '默认兜底')
    .replace(/rule-engine/gi, '规则引擎')
    .replace(/\becommerce\b/gi, '电商')
    .replace(/\bwholesale\b/gi, '批发')
    .replace(/\bstall\b/gi, '摆摊')
    .replace(/\bsupermarket\b/gi, '商超')
    .replace(/\bsimple\b/gi, '简装')
    .replace(/\bgift\b/gi, '礼盒')
    .replace(/\bpremium\b/gi, '精品礼盒')
    .replace(/\blow\b/gi, '低')
    .replace(/\bmid\b/gi, '中')
    .replace(/\bhigh\b/gi, '高')
}

function localizeSource(source) {
  if (!source || typeof source !== 'object') return source

  const engineRaw = String(source.engine || '')
  const decisionRaw = String(source.decision || '')
  const engineKey = engineRaw.trim().toLowerCase()
  const decisionKey = decisionRaw.trim().toLowerCase()

  return {
    ...source,
    engine: SOURCE_ENGINE_LABELS[engineKey] || localizeText(engineRaw) || source.engine,
    decision: SOURCE_DECISION_LABELS[decisionKey] || localizeText(decisionRaw) || source.decision
  }
}

function localizeModelVersion(modelVersion) {
  if (modelVersion === null || modelVersion === undefined || modelVersion === '') return modelVersion
  const text = String(modelVersion)
  const key = text.trim().toLowerCase()
  return MODEL_VERSION_LABELS[key] || localizeText(text)
}

function normalizeSuggestionActions(value) {
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 3)
  }

  if (typeof value !== 'string') return []

  return value
    .replace(/\r/g, '\n')
    .replace(/[；;]/g, '\n')
    .replace(/[。]\s*/g, '\n')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function localizeResultView(result) {
  if (!result || typeof result !== 'object') return result

  const recommendation = result.recommendation || {}
  return {
    ...result,
    reason: localizeText(result.reason || ''),
    explanation: localizeText(result.explanation || result.reason || ''),
    recommendation: {
      title: localizeText(recommendation.title || '分级与销售建议'),
      summary: localizeText(recommendation.summary || ''),
      actions: normalizeSuggestionActions(recommendation.actions).map(localizeText),
      riskNote: localizeText(recommendation.riskNote || ''),
    },
    riskWarning: localizeText(result.riskWarning || ''),
    source: localizeSource(result.source),
    modelVersion: localizeModelVersion(result.modelVersion)
  }
}

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

    diameter: '',
    brix: '',
    weight: '',
    defectLevel: 'mid',
    defectLevelText: DEFECT_LEVEL_CODE_TO_LABEL.mid,

    channelColumns: CHANNEL_OPTIONS,
    packageColumns: PACKAGE_OPTIONS,
    regionColumns: REGION_OPTIONS,
    defectColumns: DEFECT_OPTIONS,

    showChannelPicker: false,
    showPackagePicker: false,
    showRegionPicker: false,
    showDefectPicker: false,

    grading: false,
    showResult: false,
    gradeFailed: false,
    result: null,
    scores: [],

    baseline: null
  },

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

  onShowChannelPicker() { this.setData({ showChannelPicker: true }) },
  onCloseChannelPicker() { this.setData({ showChannelPicker: false }) },
  onConfirmChannel(e) { this.setData({ channel: e.detail.value, showChannelPicker: false }) },

  onShowPackagePicker() { this.setData({ showPackagePicker: true }) },
  onClosePackagePicker() { this.setData({ showPackagePicker: false }) },
  onConfirmPackage(e) { this.setData({ packaging: e.detail.value, showPackagePicker: false }) },

  onShowRegionPicker() { this.setData({ showRegionPicker: true }) },
  onCloseRegionPicker() { this.setData({ showRegionPicker: false }) },
  onConfirmRegion(e) { this.setData({ region: e.detail.value, showRegionPicker: false }) },

  onShowDefectPicker() { this.setData({ showDefectPicker: true }) },
  onCloseDefectPicker() { this.setData({ showDefectPicker: false }) },
  onConfirmDefect(e) {
    const defectLevelText = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value
    this.setData({
      defectLevel: DEFECT_LEVEL_LABEL_TO_CODE[defectLevelText] || 'mid',
      defectLevelText,
      showDefectPicker: false
    })
  },

  onDiameterInput(e) { this.setData({ diameter: e.detail.value }) },
  onBrixInput(e) { this.setData({ brix: e.detail.value }) },
  onWeightInput(e) { this.setData({ weight: e.detail.value }) },

  hasStructuredInput() {
    const { diameter, brix, weight, defectLevel } = this.data
    return Boolean(diameter || brix || weight || defectLevel)
  },

  toOptionalNumber(value) {
    if (value === '' || value === null || value === undefined) return undefined
    const num = Number(value)
    return Number.isFinite(num) ? num : undefined
  },

  async onStartGrade() {
    if (!this.data.imagePath && !this.hasStructuredInput()) {
      wx.showToast({ title: '请上传图片或填写结构化参数', icon: 'none' })
      return
    }
    if (this.data.grading) return

    this.setData({ grading: true, showResult: false, gradeFailed: false })

    try {
      const result = await priceService.gradeAndPrice(this.data.imagePath, {
        channel: this.data.channel,
        packageType: this.data.packaging,
        packaging: this.data.packaging,
        region: this.data.region,
        diameter: this.toOptionalNumber(this.data.diameter),
        brix: this.toOptionalNumber(this.data.brix),
        weight: this.toOptionalNumber(this.data.weight),
        defectLevel: this.data.defectLevel
      })

      const localizedResult = localizeResultView(result)
      this.setData({
        result: localizedResult,
        scores: buildScores(localizedResult),
        showResult: true
      })

      this._fetchBaseline(localizedResult.variety)
    } catch (err) {
      this.setData({ gradeFailed: true })
      if (!err._toasted) {
        wx.showToast({ title: err.message || '分级失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ grading: false })
    }
  },

  async _fetchBaseline(variety) {
    try {
      const baseline = await priceService.getBaseline(variety, this.data.region)
      if (baseline) this.setData({ baseline })
    } catch (e) {
      console.warn('基准价查询失败（不影响分级结果）', e)
    }
  }
})

