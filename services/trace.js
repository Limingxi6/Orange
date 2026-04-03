const { request, mockResolve, tryReal } = require('./request')

const MOCK_TRACE = {
  batchInfo: {
    name: '2026春-纽荷尔脐橙A区',
    variety: '纽荷尔脐橙',
    plotName: '东区3号地',
    plotLocation: '湖北省宜城市',
    area: '5亩',
    plantDate: '2026-01-15',
    stage: '果实膨大期',
    status: '种植中'
  },
  gradeInfo: {
    grade: '一级果',
    retailPrice: '6.8 ~ 8.2 元/斤',
    wholesalePrice: '4.2 ~ 5.5 元/斤',
    colorScore: 92,
    sizeScore: 88,
    maturityScore: 90,
    defectRatio: 3
  },
  timeline: [
    { time: '2026-03-16 09:30', type: '识别', content: 'AI 识别叶片，判定疑似溃疡病（91%），已标记待复核' },
    { time: '2026-03-15 09:00', type: '施肥', content: '春季追肥，复合肥 15kg/亩' },
    { time: '2026-03-10 14:00', type: '喷药', content: '波尔多液预防性喷施，全园覆盖' },
    { time: '2026-03-07 08:30', type: '浇水', content: '灌溉一次，土壤湿度恢复至 65%' },
    { time: '2026-02-28 10:00', type: '修剪', content: '春季整形修剪，去除病枝弱枝' },
    { time: '2026-02-20 16:00', type: '施肥', content: '基肥施入，有机肥 20kg/亩' },
    { time: '2026-01-15 10:00', type: '种植', content: '批次创建，开始种植管理' }
  ],
  diseaseRecords: [
    { date: '2026-03-16', label: '疑似柑橘溃疡病', confidence: 91, severity: '中', status: 'review' },
    { date: '2026-03-08', label: '健康', confidence: 95, severity: '无', status: 'normal' }
  ],
  chainAnchors: [
    { eventType: '批次创建', time: '2026-01-15 10:00', txId: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abcd', status: 'verified' },
    { eventType: '施肥记录', time: '2026-02-20 16:15', txId: '0x112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00', status: 'verified' },
    { eventType: '喷药记录', time: '2026-03-10 14:30', txId: '0x789fab012345cde6789fab012345cde6789fab012345cde6789fab012345cde6', status: 'verified' },
    { eventType: '识别记录', time: '2026-03-16 09:35', txId: '0x345cde678901fab2345cde678901fab2345cde678901fab2345cde678901fab2', status: 'pending' }
  ],
  overallChainStatus: 'verified',
  verifiedCount: 3,
  totalAnchorCount: 4
}

const traceService = {
  /**
   * 获取溯源信息
   * GET /api/trace/:code
   * @param {string|number} code
   * @returns {{ batchInfo, gradeInfo, timeline, diseaseRecords, chainAnchors, overallChainStatus, verifiedCount, totalAnchorCount }}
   */
  getInfo(code) {
    return tryReal(
      () => request({ url: `/api/trace/${code}`, method: 'GET' }),
      () => mockResolve(MOCK_TRACE)
    )
  },

  /**
   * 区块链验证
   * GET /api/trace/:code/verify
   * @param {string|number} code
   * @returns {{ status, message }}
   */
  verifyChain(code) {
    return tryReal(
      () => request({ url: `/api/trace/${code}/verify`, method: 'GET' }),
      () => mockResolve({ status: 'verified', message: '全部节点验证通过' }, 1000)
    )
  }
}

module.exports = traceService
