const { request, mockResolve, tryReal } = require('./request')

const MOCK_BATCH_LIST = [
  {
    id: 1, name: '2026春-纽荷尔脐橙A区', variety: '纽荷尔脐橙',
    plotName: '东区3号地', stage: '果实膨大期', status: '种植中', plantDate: '2026-01-15'
  },
  {
    id: 2, name: '2025秋-纽荷尔脐橙B区', variety: '纽荷尔脐橙',
    plotName: '西区1号地', stage: '已采收', status: '已采收', plantDate: '2025-09-01'
  },
  {
    id: 3, name: '2026春-纽荷尔脐橙C区', variety: '纽荷尔脐橙',
    plotName: '南区2号地', stage: '花期', status: '种植中', plantDate: '2026-02-20'
  }
]

const MOCK_BATCH_DETAIL = {
  '1': {
    id: 1, name: '2026春-纽荷尔脐橙A区', variety: '纽荷尔脐橙',
    plotName: '东区3号地', plantDate: '2026-01-15', stage: '果实膨大期', status: '种植中'
  },
  '2': {
    id: 2, name: '2025秋-纽荷尔脐橙B区', variety: '纽荷尔脐橙',
    plotName: '西区1号地', plantDate: '2025-09-01', stage: '已采收', status: '已采收'
  },
  '3': {
    id: 3, name: '2026春-纽荷尔脐橙C区', variety: '纽荷尔脐橙',
    plotName: '南区2号地', plantDate: '2026-02-20', stage: '花期', status: '种植中'
  }
}

function _toUiBatch(item) {
  if (!item) return null
  return {
    id: item.id,
    name: item.batchNo || item.name || '',
    variety: item.variety || '',
    plotName: item.orchardName || item.plotName || '',
    area: item.area || '',
    plantDate: item.plantingDate || item.plantDate || '',
    stage: item.stage || '',
    status: item.status || '种植中',
    managerId: item.managerId
  }
}

function _toCreateDto(data = {}) {
  const areaNum = Number(data.area)
  const areaText = Number.isFinite(areaNum) && areaNum > 0
    ? `${areaNum}亩`
    : undefined

  return {
    // 小程序“批次名称”映射为后端 batchNo
    batchNo: (data.name || '').trim() || undefined,
    orchardName: (data.plotName || '').trim(),
    variety: (data.variety || '').trim(),
    area: areaText,
    plantingDate: data.plantDate,
    stage: '苗期'
  }
}

const batchService = {
  /**
   * 获取批次列表
   * GET /api/batches
   * @param {{ keyword?, page?, limit?, sort? }} params
   * @returns {Array<{ id, name, variety, plotName, stage, status, plantDate }>}
   */
  getList(params = {}) {
    return tryReal(
      () => request({ url: '/api/batches', method: 'GET', data: params }).then((res) => {
        const list = Array.isArray(res?.list) ? res.list : []
        return list.map(_toUiBatch)
      }),
      () => {
        let list = MOCK_BATCH_LIST
        if (params.keyword) {
          const kw = params.keyword.toLowerCase()
          list = list.filter(b => b.name.toLowerCase().includes(kw) || b.variety.toLowerCase().includes(kw))
        }
        return mockResolve(list)
      }
    )
  },

  /**
   * 获取批次详情
   * GET /api/batches/:id
   * @param {string|number} id
   * @returns {{ id, name, variety, plotName, plantDate, stage, status }}
   */
  getDetail(id) {
    return tryReal(
      () => request({ url: `/api/batches/${id}`, method: 'GET' }).then(_toUiBatch),
      () => mockResolve(MOCK_BATCH_DETAIL[String(id)] || MOCK_BATCH_DETAIL['1'])
    )
  },

  /**
   * 创建批次
   * POST /api/batches
   * @param {{ name, variety, plotName, area, plantDate }} data
   * @returns {{ id }}
   */
  create(data) {
    // 创建接口不做 mock 降级，避免“写入失败但前端显示成功”
    return request({ url: '/api/batches', method: 'POST', data: _toCreateDto(data) })
  },

  /**
   * 更新批次阶段
   * PUT /api/batches/:id/stage
   * @param {string|number} id
   * @param {string} stage
   * @returns {{ success: boolean }}
   */
  updateStage(id, stage) {
    return tryReal(
      () => request({ url: `/api/batches/${id}/stage`, method: 'PUT', data: { stage } }),
      () => mockResolve({ success: true })
    )
  }
}

module.exports = batchService
