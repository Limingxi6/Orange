const { request, mockResolve, tryReal } = require('./request')

const MOCK_LOGS = [
  {
    id: 1, time: '2026-03-16 09:30', type: '识别',
    content: '拍照识别叶片，AI 判定疑似柑橘溃疡病（置信度 91%，中风险），已标记待复核',
    operator: '李大橘', images: [],
    detail: '对 A 区第 3 排脐橙进行叶片拍照识别，系统返回疑似柑橘溃疡病，置信度 91%。已自动写入批次日志，建议巡园复核。'
  },
  {
    id: 2, time: '2026-03-15 09:00', type: '施肥',
    content: '春季追肥，施用复合肥 15kg/亩',
    operator: '李大橘', images: [],
    detail: '对 A 区纽荷尔脐橙进行春季追肥，使用 15-15-15 复合肥，每亩 15kg，撒施后浅翻覆土。'
  },
  {
    id: 3, time: '2026-03-10 14:00', type: '喷药',
    content: '波尔多液预防性喷施，全园覆盖',
    operator: '李大橘', images: [],
    detail: '配制 0.5% 波尔多液 200L，对全园进行预防性喷施，重点覆盖春梢嫩叶和老叶背面。天气预报未来 3 天有雨，提前喷施。'
  },
  {
    id: 4, time: '2026-03-07 08:30', type: '浇水',
    content: '灌溉一次，土壤湿度恢复至 65%',
    operator: '李大橘', images: [],
    detail: '近期持续干燥，A 区土壤湿度降至 40% 以下。本次灌溉约 2 小时，灌后检测土壤湿度恢复至 65%。'
  },
  {
    id: 5, time: '2026-02-28 10:00', type: '修剪',
    content: '春季整形修剪，去除病枝弱枝',
    operator: '李大橘', images: [],
    detail: '对 A 区全部 120 棵脐橙进行整形修剪，主要去除交叉枝、下垂枝、病枝和细弱枝。每棵约修剪 15-20 个枝条，修剪废枝已集中清理。'
  },
  {
    id: 6, time: '2026-02-20 16:00', type: '施肥',
    content: '基肥施入，有机肥 20kg/亩',
    operator: '李大橘', images: [],
    detail: '春季基肥，每亩施入发酵有机肥 20kg + 过磷酸钙 2kg，环状沟施，沟深约 20cm，施后回填覆土。'
  },
  {
    id: 7, time: '2025-12-20 11:00', type: '采摘',
    content: 'B 区纽荷尔脐橙采摘完成，总计 1800 斤',
    operator: '李大橘', images: [],
    detail: 'B 区 2025 秋批次纽荷尔脐橙全部采摘完成，共采收 1800 斤。果实整体品质较好，少数有轻微日灼。采后已入库待分级。'
  },
  {
    id: 8, time: '2025-12-21 14:00', type: '分级',
    content: 'B 区脐橙分级完成：一级果 60%、二级果 30%、三级果 10%',
    operator: '李大橘', images: [],
    detail: '对 B 区 1800 斤脐橙进行拍照分级。一级果 1080 斤（色泽均匀、无缺陷），二级果 540 斤（轻微色斑），三级果 180 斤（日灼或偏小）。'
  },
  {
    id: 9, time: '2025-12-25 09:00', type: '销售',
    content: 'B 区一级果已上架电商渠道，建议零售价 7.5 元/斤',
    operator: '李大橘', images: [],
    detail: '一级果 1080 斤已生成溯源二维码并上架电商渠道。建议零售价 7.5 元/斤（基准价 6.0 × 品质系数 1.1 × 渠道系数 1.05 × 追溯溢价 1.08）。'
  }
]

const MOCK_LOG_TYPES = [
  { label: '全部', value: 'all', icon: 'apps-o' },
  { label: '识别', value: '识别', icon: 'scan' },
  { label: '浇水', value: '浇水', icon: 'drop' },
  { label: '施肥', value: '施肥', icon: 'flower-o' },
  { label: '喷药', value: '喷药', icon: 'shield-o' },
  { label: '修剪', value: '修剪', icon: 'scissors' },
  { label: '采摘', value: '采摘', icon: 'shopping-cart-o' },
  { label: '分级', value: '分级', icon: 'gem-o' },
  { label: '销售', value: '销售', icon: 'cash-back-record' }
]

const LOG_TYPE_LABEL_MAP = {
  inspection: '识别',
  irrigation: '浇水',
  fertilization: '施肥',
  pesticide: '喷药',
  pruning: '修剪',
  harvest: '采摘',
  grading: '分级',
  sales: '销售',
  识别: '识别',
  浇水: '浇水',
  施肥: '施肥',
  喷药: '喷药',
  修剪: '修剪',
  采摘: '采摘',
  分级: '分级',
  销售: '销售'
}

function _normalizeLogItem(item = {}) {
  const type = item.type || ''
  const images = Array.isArray(item.images) ? item.images : []
  const safeImages = images.filter((url) => {
    if (typeof url !== 'string' || !url) return false
    if (/^https?:\/\/example\.com\//i.test(url)) return false
    return true
  })

  return {
    ...item,
    typeText: LOG_TYPE_LABEL_MAP[type] || type,
    images: safeImages
  }
}

const logService = {
  /**
   * 获取批次日志列表
   * GET /api/logs?batchId=:batchId
   * @param {string|number} batchId
   * @param {{ type? }} params - type 枚举: 识别/浇水/施肥/喷药/修剪/采摘/分级/销售
   * @returns {Array<{ id, time, type, content, operator, images, detail }>}
   */
  getListByBatch(batchId, params = {}) {
    const query = { batchId: Number(batchId) }
    if (params.type && params.type !== 'all') query.type = params.type

    return tryReal(
      () => request({ url: '/api/logs', method: 'GET', data: query }).then((list) => {
        const rows = Array.isArray(list) ? list : []
        return rows.map(_normalizeLogItem)
      }),
      () => {
        let list = MOCK_LOGS
        if (params.type && params.type !== 'all') {
          list = list.filter(item => item.type === params.type)
        }
        return mockResolve(list.map(_normalizeLogItem))
      }
    )
  },

  /**
   * 新建日志
   * POST /api/logs
   * @param {{ batch_id, log_type, description, image_url, source }} data
   *   source: 'disease_recognize' | 'manual'
   * @returns {{ id }}
   */
  create(data) {
    return tryReal(
      () => request({ url: '/api/logs', method: 'POST', data }),
      () => mockResolve({ id: Date.now() })
    )
  },

  /**
   * 获取日志类型列表
   * GET /api/logs/types
   * @returns {Array<{ label, value, icon }>}
   */
  getTypes() {
    return tryReal(
      () => request({ url: '/api/logs/types', method: 'GET' }),
      () => mockResolve(MOCK_LOG_TYPES)
    )
  }
}

module.exports = logService
