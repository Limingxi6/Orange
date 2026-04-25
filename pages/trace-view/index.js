const traceService = require('../../services/trace')

Page({
  data: {
    code: '',
    traceCode: '',
    noTraceCode: false,
    invalidTraceCode: false,
    traceNotFound: false,
    loading: true,
    loadFailed: false,
    hasTraceData: false,
    traceSummary: null,
    buyerSummary: null,

    batchInfo: null,
    gradeInfo: null,
    originPlotText: '--',
    stageStatusText: '--',

    timeline: [],
    keyTimeline: [],
    processHighlights: [],

    diseaseRecords: [],
    latestDisease: null,
    latestDiseaseDateText: '--',
    latestDiseaseSeverityText: '--',
    latestDiseaseReviewText: '--',
    latestDiseaseConfidenceText: '--',
    latestDiseaseStatusText: '--',

    chainAnchors: [],
    overallChainStatus: 'pending',
    verifiedCount: 0,
    totalAnchorCount: 0,
    verified: null,
    verifyMessage: '',
    proofType: '',
    proofHash: '',
    anchorStatus: 'not_anchored',
    proofTxId: '',
    chainProvider: '',
    chainNetwork: '',
    anchoredAt: '',

    proofTypeText: '--',
    proofHashShort: '--',
    proofTxIdShort: '--',
    anchorStatusText: '--',
    verifyResultText: '待校验',
    mainVerifyTitle: '',
    mainVerifyDesc: '',

    retailPriceText: '--',
    wholesalePriceText: '--',
    defectRatioText: '--',

    verifying: false,
    verifyFailed: false,
  },

  onLoad(options) {
    const code = traceService.resolveTraceCodeFromOptions(options)
    if (!code) {
      const hasInput = traceService.hasTraceInput(options)
      this.setData({
        loading: false,
        noTraceCode: !hasInput,
        invalidTraceCode: hasInput,
      })
      return
    }

    this.setData({
      code,
      traceCode: code,
      noTraceCode: false,
      invalidTraceCode: false,
      traceNotFound: false,
    })
    this.fetchTrace(code)
  },

  async fetchTrace(code) {
    const rawCode = String(code || this.data.code || this.data.traceCode || '').trim()
    const targetCode = traceService.extractTraceCode(rawCode)
    if (!targetCode) {
      this.setData({
        loading: false,
        loadFailed: false,
        noTraceCode: !rawCode,
        invalidTraceCode: Boolean(rawCode),
        traceNotFound: false,
      })
      return
    }

    this.setData({
      loading: true,
      loadFailed: false,
      noTraceCode: false,
      invalidTraceCode: false,
      traceNotFound: false,
    })

    try {
      const data = await traceService.getInfo(targetCode)
      if (!data) {
        this.setData({
          loading: false,
          loadFailed: false,
          traceNotFound: true,
          hasTraceData: false,
        })
        return
      }

      const batchInfo = data.batchInfo || null
      const gradeInfo = data.gradeInfo || null
      const batchInfoData = batchInfo || {}
      const gradeInfoData = gradeInfo || {}
      const timeline = Array.isArray(data.timeline) ? data.timeline : []
      const diseaseRecords = Array.isArray(data.diseaseRecords) ? data.diseaseRecords : []
      const keyTimeline = timeline.slice(0, 5)
      const processHighlights = this._buildProcessHighlights(timeline)
      const latestDisease = this._pickLatestDisease(diseaseRecords)
      const latestDiseaseView = this._buildLatestDiseaseView(latestDisease)
      const buyerSummary = data.buyerSummary || data.traceSummary || null
      const resolvedCode = traceService.extractTraceCode(data.traceCode || data.code) || targetCode
      const verifyPatch = this._buildVerifyPatch(data, data.chainAnchors, data.createdAt)

      this.setData({
        loading: false,
        loadFailed: false,
        noTraceCode: false,
        invalidTraceCode: false,
        traceNotFound: false,
        code: resolvedCode,
        traceCode: resolvedCode,
        batchInfo: batchInfoData,
        gradeInfo: gradeInfoData,
        originPlotText: this._joinWithSlash(
          batchInfoData.plotLocation,
          batchInfoData.plotName,
        ),
        stageStatusText: this._joinWithSlash(
          batchInfoData.stage,
          batchInfoData.status,
        ),
        timeline,
        keyTimeline,
        processHighlights,
        diseaseRecords,
        latestDisease,
        latestDiseaseDateText: latestDiseaseView.dateText,
        latestDiseaseSeverityText: latestDiseaseView.severityText,
        latestDiseaseReviewText: latestDiseaseView.reviewText,
        latestDiseaseConfidenceText: latestDiseaseView.confidenceText,
        latestDiseaseStatusText: latestDiseaseView.statusText,
        traceSummary: data.traceSummary || buyerSummary,
        buyerSummary,
        hasTraceData: this._hasRenderableTraceData(
          batchInfoData,
          gradeInfoData,
          timeline,
          diseaseRecords,
          buyerSummary,
          verifyPatch,
        ),
        retailPriceText: this._formatPriceRange(
          gradeInfoData.retailMinPrice,
          gradeInfoData.retailMaxPrice,
          gradeInfoData.retailPrice,
        ),
        wholesalePriceText: this._formatPriceRange(
          gradeInfoData.wholesaleMinPrice,
          gradeInfoData.wholesaleMaxPrice,
          gradeInfoData.wholesalePrice,
        ),
        defectRatioText: this._formatDefectRatio(gradeInfoData.defectRatio),
        ...verifyPatch,
      })
    } catch (err) {
      console.error('溯源详情加载失败', err)
      if (err && err.code === 'INVALID_TRACE_CODE') {
        this.setData({
          loading: false,
          loadFailed: false,
          noTraceCode: false,
          invalidTraceCode: true,
          traceNotFound: false,
        })
        return
      }

      if (this._isTraceNotFoundError(err)) {
        this.setData({
          loading: false,
          loadFailed: false,
          noTraceCode: false,
          invalidTraceCode: false,
          traceNotFound: true,
          hasTraceData: false,
        })
        return
      }

      this.setData({ loading: false, loadFailed: true, traceNotFound: false })
      if (!err._toasted) {
        wx.showToast({ title: this._resolveErrorMessage(err), icon: 'none' })
      }
    }
  },

  onRetry() {
    this.fetchTrace(this.data.code || this.data.traceCode)
  },

  async onPullDownRefresh() {
    await this.fetchTrace(this.data.code || this.data.traceCode)
    wx.stopPullDownRefresh()
  },

  async onVerifyChain() {
    if (this.data.verifying) return

    const targetCode = traceService.extractTraceCode(this.data.code || this.data.traceCode)
    if (!targetCode) {
      wx.showToast({ title: '未识别到有效溯源码', icon: 'none' })
      return
    }

    this.setData({ verifying: true, verifyFailed: false })
    try {
      const res = await traceService.verifyChain(targetCode)
      const verifyPatch = this._buildVerifyPatch(res, this.data.chainAnchors)
      const isVerified = verifyPatch.verified === true || verifyPatch.overallChainStatus === 'verified'

      this.setData({ ...verifyPatch })

      const message =
        (res && res.message) ||
        verifyPatch.mainVerifyTitle ||
        (isVerified ? '哈希验真通过' : '哈希验真未通过')

      wx.showToast({ title: message, icon: isVerified ? 'success' : 'none' })
    } catch (err) {
      this.setData({ verifyFailed: true })
      if (!err._toasted) {
        wx.showToast({ title: '验真失败，请稍后重试', icon: 'none' })
      }
    } finally {
      this.setData({ verifying: false })
    }
  },

  onCopyTxId(e) {
    const txId = e.currentTarget.dataset.txid
    if (!txId) return
    this._copyText(txId, '交易哈希已复制')
  },

  onCopyProofHash(e) {
    const proofHash = e.currentTarget.dataset.hash
    if (!proofHash) return
    this._copyText(proofHash, '哈希摘要已复制')
  },

  _copyText(value, successMessage) {
    wx.setClipboardData({
      data: String(value),
      success() {
        wx.showToast({ title: successMessage || '已复制', icon: 'success' })
      },
    })
  },

  _buildVerifyPatch(rawResult, rawAnchors, fallbackTime) {
    const verifyState = this._resolveVerifyState(rawResult)
    const chainAnchors = this._buildAnchors(rawAnchors, verifyState, fallbackTime)
    const anchorStats = this._countAnchors(chainAnchors)
    const mainVerify = this._buildMainVerifyText(verifyState)

    return {
      chainAnchors,
      overallChainStatus: verifyState.status,
      verifiedCount: anchorStats.verifiedCount,
      totalAnchorCount: anchorStats.totalAnchorCount,
      verified: verifyState.verified,
      verifyMessage: verifyState.message,
      proofType: verifyState.proofType,
      proofHash: verifyState.proofHash,
      anchorStatus: verifyState.anchorStatus,
      proofTxId: verifyState.txId,
      chainProvider: verifyState.chainProvider,
      chainNetwork: verifyState.chainNetwork,
      anchoredAt: verifyState.anchoredAt,
      proofTypeText: this._formatProofType(verifyState.proofType),
      anchorStatusText: this._formatAnchorStatus(verifyState.anchorStatus),
      verifyResultText: this._formatVerifyResult(verifyState.status),
      proofHashShort: this._shortHash(verifyState.proofHash),
      proofTxIdShort: this._shortHash(verifyState.txId),
      mainVerifyTitle: mainVerify.title,
      mainVerifyDesc: mainVerify.desc,
      verifyFailed: verifyState.verified === false || verifyState.status === 'failed',
    }
  },

  _resolveVerifyState(payload) {
    const data = payload && typeof payload === 'object' ? payload : {}
    const anchors = Array.isArray(data.chainAnchors) ? data.chainAnchors : []
    const primaryAnchor = anchors[0] || {}

    const verifiedValue = this._resolveVerifiedValue(data)
    const status =
      typeof verifiedValue === 'boolean'
        ? verifiedValue
          ? 'verified'
          : 'failed'
        : this._normalizeVerifyStatus(data.overallChainStatus || data.status)

    const anchorStatus =
      this._normalizeAnchorStatus(data.anchorStatus || primaryAnchor.anchorStatus || primaryAnchor.status) ||
      'not_anchored'

    return {
      verified: typeof verifiedValue === 'boolean' ? verifiedValue : null,
      status,
      message: data.message || data.verifyMessage || this._defaultVerifyMessage(status),
      proofType: data.proofType || primaryAnchor.proofType || 'hash',
      proofHash: data.proofHash || data.chainHash || primaryAnchor.proofHash || primaryAnchor.chainHash || '',
      anchorStatus,
      txId: data.txId || primaryAnchor.txId || '',
      chainProvider: data.chainProvider || primaryAnchor.chainProvider || '',
      chainNetwork: data.chainNetwork || primaryAnchor.chainNetwork || '',
      anchoredAt: this._formatDateTime(data.anchoredAt || primaryAnchor.anchoredAt),
    }
  },

  _resolveVerifiedValue(data) {
    if (data && typeof data.verified === 'boolean') {
      return data.verified
    }

    const status = String((data && data.status) || '').toLowerCase()
    if (status === 'verified' || status === 'success') return true
    if (status === 'failed') return false
    return undefined
  },

  _normalizeVerifyStatus(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'verified' || normalized === 'success') return 'verified'
    if (normalized === 'failed') return 'failed'
    return 'pending'
  },

  _defaultVerifyMessage(status) {
    if (status === 'verified') return '当前溯源快照与存证摘要一致。'
    if (status === 'failed') return '当前溯源快照与存证摘要不一致。'
    return '当前校验结果仍以本地哈希比对为准。'
  },

  _formatProofType(proofType) {
    const normalized = String(proofType || '').toLowerCase()
    if (normalized === 'hash') return '哈希存证'
    return proofType || '--'
  },

  _normalizeAnchorStatus(anchorStatus) {
    const normalized = String(anchorStatus || '').toLowerCase()
    if (normalized === 'success') return 'success'
    if (normalized === 'failed') return 'failed'
    if (normalized === 'pending') return 'pending'
    if (normalized === 'not_anchored') return 'not_anchored'
    return ''
  },

  _formatAnchorStatus(anchorStatus) {
    const normalized = this._normalizeAnchorStatus(anchorStatus)
    if (normalized === 'success') return '已完成链锚定'
    if (normalized === 'failed') return '链锚定失败'
    if (normalized === 'pending') return '链锚定处理中'
    if (normalized === 'not_anchored') return '暂未链锚定'
    return '--'
  },

  _formatVerifyResult(status) {
    const normalized = this._normalizeVerifyStatus(status)
    if (normalized === 'verified') return '通过'
    if (normalized === 'failed') return '未通过'
    return '待校验'
  },

  _buildMainVerifyText(verifyState) {
    if (verifyState.verified === true || verifyState.status === 'verified') {
      return {
        title: '哈希验真通过',
        desc: '这批产品溯源信息未被篡改，可放心查看。',
      }
    }

    if (verifyState.verified === false || verifyState.status === 'failed') {
      return {
        title: '哈希验真未通过',
        desc: '当前信息与存证摘要不一致，请谨慎购买并联系商家复核。',
      }
    }

    return {
      title: '等待校验中',
      desc: '链上锚定是增强证明，当前仍以本地哈希比对结果为准。',
    }
  },

  _buildAnchors(rawAnchors, verifyState, fallbackTime) {
    let anchors = Array.isArray(rawAnchors) ? rawAnchors.slice() : []
    const fallbackAnchorTime = this._formatDateTime(fallbackTime) || this._formatNow()

    if (anchors.length === 0 && verifyState.proofHash) {
      anchors = [
        {
          eventType: '溯源快照哈希',
          time: fallbackAnchorTime,
          proofHash: verifyState.proofHash,
          proofType: verifyState.proofType,
          anchorStatus: verifyState.anchorStatus,
          txId: verifyState.txId,
          chainProvider: verifyState.chainProvider,
          chainNetwork: verifyState.chainNetwork,
          anchoredAt: verifyState.anchoredAt,
          status: verifyState.status,
        },
      ]
    }

    return anchors.map((item) => {
      const anchorStatus =
        this._normalizeAnchorStatus(item.anchorStatus || verifyState.anchorStatus) || 'not_anchored'
      const proofHash = item.proofHash || item.chainHash || item.hash || verifyState.proofHash || ''
      const txId = item.txId || verifyState.txId || ''

      return {
        ...item,
        eventType: item.eventType || '溯源快照哈希',
        time: item.time || fallbackAnchorTime,
        status: this._normalizeAnchorVerifyStatus(item.status, verifyState.status),
        proofType: item.proofType || verifyState.proofType || 'hash',
        proofHash,
        proofHashShort: this._shortHash(proofHash),
        anchorStatus,
        anchorStatusText: this._formatAnchorStatus(anchorStatus),
        txId,
        txIdShort: this._shortHash(txId),
        chainProvider: item.chainProvider || verifyState.chainProvider || '',
        chainNetwork: item.chainNetwork || verifyState.chainNetwork || '',
        anchoredAt: this._formatDateTime(item.anchoredAt || verifyState.anchoredAt),
      }
    })
  },

  _normalizeAnchorVerifyStatus(anchorStatus, verifyStatus) {
    if (verifyStatus === 'verified') return 'verified'
    if (verifyStatus === 'failed') return 'failed'

    const normalized = String(anchorStatus || '').toLowerCase()
    if (normalized === 'verified' || normalized === 'success') return 'verified'
    if (normalized === 'failed') return 'failed'
    return 'pending'
  },

  _countAnchors(anchors) {
    const list = Array.isArray(anchors) ? anchors : []
    return {
      verifiedCount: list.filter((item) => item && item.status === 'verified').length,
      totalAnchorCount: list.length,
    }
  },

  _buildProcessHighlights(timeline) {
    const list = Array.isArray(timeline) ? timeline : []
    return list.slice(0, 3).map((item) => {
      const type = item.type || '生产记录'
      const content = item.content || '--'
      return `${type}：${content}`
    })
  },

  _pickLatestDisease(records) {
    const list = Array.isArray(records) ? records.slice() : []
    if (list.length === 0) return null

    list.sort((a, b) => {
      const timeA = new Date(a.date || a.createdAt || 0).getTime()
      const timeB = new Date(b.date || b.createdAt || 0).getTime()
      return timeB - timeA
    })

    return list[0]
  },

  _buildLatestDiseaseView(disease) {
    if (!disease) {
      return {
        dateText: '--',
        severityText: '--',
        reviewText: '--',
        confidenceText: '--',
        statusText: '--',
      }
    }

    return {
      dateText: disease.date || this._formatDateTime(disease.createdAt) || '--',
      severityText: disease.severity || '--',
      reviewText: this._formatManualReview(disease.needManualReview, disease.status),
      confidenceText: this._formatConfidence(disease.confidence),
      statusText: this._formatDiseaseStatus(disease.status),
    }
  },

  _joinWithSlash(first, second) {
    const left = String(first || '').trim() || '--'
    const right = String(second || '').trim() || '--'
    return `${left} / ${right}`
  },

  _formatPriceRange(minValue, maxValue, fallback) {
    const min = Number(minValue)
    const max = Number(maxValue)

    if (Number.isFinite(min) && Number.isFinite(max)) return `${min} - ${max}`
    if (Number.isFinite(min)) return `${min}`
    if (Number.isFinite(max)) return `${max}`

    const text = String(fallback || '').trim()
    return text || '--'
  },

  _formatDefectRatio(value) {
    const ratio = Number(value)
    if (!Number.isFinite(ratio)) return '--'
    return `${ratio}%`
  },

  _formatConfidence(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return '--'
    if (n >= 0 && n <= 1) return `${Math.round(n * 100)}%`
    return `${Math.round(n)}%`
  },

  _formatManualReview(value, status) {
    if (typeof value === 'boolean') {
      return value ? '需要人工复核' : '无需人工复核'
    }

    const normalized = String(status || '').toLowerCase()
    if (normalized === 'review') return '需要人工复核'
    if (normalized === 'normal' || normalized === 'healthy') return '无需人工复核'
    return '--'
  },

  _formatDiseaseStatus(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'normal' || normalized === 'healthy') return '未见异常'
    if (normalized === 'review') return '待复核'
    return status || '--'
  },

  _shortHash(value, head = 10, tail = 8) {
    const text = String(value || '').trim()
    if (!text) return '--'
    if (text.length <= head + tail + 3) return text
    return `${text.slice(0, head)}...${text.slice(-tail)}`
  },

  _hasRenderableTraceData(batchInfo, gradeInfo, timeline, diseaseRecords, buyerSummary, verifyPatch) {
    const hasBatch = Boolean(batchInfo && Object.keys(batchInfo).length)
    const hasGrade = Boolean(gradeInfo && Object.keys(gradeInfo).length)
    const hasTimeline = Array.isArray(timeline) && timeline.length > 0
    const hasDisease = Array.isArray(diseaseRecords) && diseaseRecords.length > 0
    const hasBuyerSummary = Boolean(
      buyerSummary
        && (
          (buyerSummary.summary && String(buyerSummary.summary).trim())
          || (Array.isArray(buyerSummary.actions) && buyerSummary.actions.length > 0)
        ),
    )
    const hasVerify =
      Boolean(
        (verifyPatch && verifyPatch.verifyMessage)
          || (verifyPatch && verifyPatch.proofHash)
          || (verifyPatch && verifyPatch.proofTxId),
      )

    return hasBatch || hasGrade || hasTimeline || hasDisease || hasBuyerSummary || hasVerify
  },

  _isTraceNotFoundError(err) {
    const message = String((err && (err.message || err.errMsg)) || '').toLowerCase()
    if (!message) return false

    return (
      message.includes('404')
      || message.includes('not found')
      || message.includes('不存在')
      || message.includes('未找到')
      || message.includes('无对应')
    )
  },

  _resolveErrorMessage(err) {
    const raw = String((err && (err.message || err.errMsg)) || '').trim()
    if (!raw) return '溯源信息加载失败'
    if (this._isTraceNotFoundError(err)) return '未查询到对应溯源信息'
    if (err && err.code === 'INVALID_TRACE_CODE') return '未识别到有效溯源码'
    return raw.length > 24 ? '溯源信息加载失败' : raw
  },

  _formatDateTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}`
  },

  _formatNow() {
    const date = new Date()
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}`
  },
})
