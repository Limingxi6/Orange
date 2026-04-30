function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const FACTOR_KEY_LABELS = {
  qualityScore: '综合评分',
  ruleFactors: '规则因子',
  pricing: '定价参数',
  basePrice: '基准价',
  channelCoeff: '渠道系数',
  packageCoeff: '包装系数',
  perception: '感知结果',
  colorScore: '色泽评分',
  sizeScore: '果径评分',
  maturityScore: '成熟度评分',
  defectRatio: '缺陷率',
  detectedDiameter: '检测果径',
  confidence: '置信度',
  engine: '感知引擎',
  gradeThresholds: '分级阈值',
  defectLimits: '缺陷阈值',
  minimumScores: '最低分要求',
  gradeBy: '分级来源',
  gradeModel: '分级模型',
  modelPath: '模型路径',
  gradeModelUsed: '是否使用分级模型',
  fallback: '是否回退',
  hasStructuredSignals: '是否有结构化输入',
  mappings: '输入映射',
  diameter: '果径（毫米）',
  brix: '糖度（白利糖度）',
  weight: '重量（克）',
  defectLevel: '缺陷等级'
}

const FACTOR_VALUE_LABELS = {
  'python-ai': 'AI',
  'local-rule': '本地规则',
  'local-rules': '本地规则',
  'local-rules+grade-model': '本地规则+分级模型',
  'trained-tabular-model': '训练表格模型',
  'rule-engine': '规则引擎',
  'fallback-default': '默认兜底',
  ecommerce: '电商',
  wholesale: '批发',
  stall: '摆摊',
  supermarket: '商超',
  simple: '简装',
  gift: '礼盒',
  premium: '精品礼盒',
  low: '低',
  mid: '中',
  high: '高'
}

function localizeFactorKey(key) {
  const text = String(key || '')
  return FACTOR_KEY_LABELS[text] || text
}

function localizeFactorValueText(value) {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return value

  const lowered = text.toLowerCase()
  if (FACTOR_VALUE_LABELS[lowered]) return FACTOR_VALUE_LABELS[lowered]

  return text
    .replace(/python[- ]ai/gi, 'AI')
    .replace(/local-rules\+grade-model/gi, '本地规则+分级模型')
    .replace(/local-rules/gi, '本地规则')
    .replace(/local-rule/gi, '本地规则')
    .replace(/rule-engine/gi, '规则引擎')
    .replace(/fallback-default/gi, '默认兜底')
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

function formatFactorValue(value) {
  if (value === undefined || value === null || value === '') return '--'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '--'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'string') return localizeFactorValueText(value)

  if (Array.isArray(value)) {
    if (!value.length) return '无'
    if (value.every(v => !isPlainObject(v))) {
      return value.map(v => formatFactorValue(v)).join('，')
    }
    return value
      .map((v, idx) => (isPlainObject(v) ? `第${idx + 1}项` : formatFactorValue(v)))
      .join('，')
  }

  if (isPlainObject(value)) {
    const pairs = Object.keys(value).map(key => `${localizeFactorKey(key)}:${formatFactorValue(value[key])}`)
    return pairs.join('，')
  }

  return localizeFactorValueText(String(value))
}

function flattenFactorObject(obj, prefix = '') {
  if (!isPlainObject(obj)) return []

  let list = []
  Object.keys(obj).forEach((key) => {
    const raw = obj[key]
    const name = prefix ? `${prefix}.${localizeFactorKey(key)}` : localizeFactorKey(key)

    if (isPlainObject(raw)) {
      const nested = flattenFactorObject(raw, name)
      if (nested.length) {
        list = list.concat(nested)
      } else {
        list.push({ name, value: '无' })
      }
      return
    }

    list.push({ name, value: formatFactorValue(raw) })
  })

  return list
}

Component({
  properties: {
    variety: { type: String, value: '' },
    grade: { type: String, value: '' },
    minPrice: { type: Number, value: 0 },
    maxPrice: { type: Number, value: 0 },
    wholesaleMin: { type: Number, value: 0 },
    wholesaleMax: { type: Number, value: 0 },
    reason: { type: String, value: '' },
    riskWarning: { type: String, value: '' },
    factors: {
      type: null,
      value: null,
      observer(val) { this._parseFactors(val) }
    }
  },

  data: {
    factorList: []
  },

  lifetimes: {
    attached() { this._parseFactors(this.properties.factors) }
  },

  methods: {
    _parseFactors(val) {
      let factorList = []
      if (val) {
        if (Array.isArray(val)) {
          factorList = val.map((item, idx) => {
            if (isPlainObject(item) && Object.prototype.hasOwnProperty.call(item, 'name')) {
              return {
                name: localizeFactorKey(String(item.name || `因子${idx + 1}`)),
                value: formatFactorValue(item.value)
              }
            }
            return {
              name: `因子${idx + 1}`,
              value: formatFactorValue(item)
            }
          })
        } else if (typeof val === 'object') {
          factorList = flattenFactorObject(val)
        }
      }
      this.setData({ factorList })
    }
  }
})
