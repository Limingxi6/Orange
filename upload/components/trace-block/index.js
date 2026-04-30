Component({
  properties: {
    batchInfo: {
      type: Object,
      value: {},
      observer(newVal) {
        this.setData({
          batchName: newVal?.name || '',
          variety: newVal?.variety || '',
          plotName: newVal?.plotName || ''
        })
      }
    },
    timeline: {
      type: Array,
      value: [],
      observer(newVal) {
        this.setData({ timelineList: newVal || [] })
      }
    },
    chainStatus: {
      type: String,
      value: 'pending',
      observer(newVal) {
        this.setData({
          statusClass: newVal === 'verified' ? 'status-verified' : (newVal === 'failed' ? 'status-failed' : 'status-pending')
        })
      }
    },
    txId: {
      type: String,
      value: ''
    }
  },

  data: {
    batchName: '',
    variety: '',
    plotName: '',
    timelineList: [],
    statusClass: 'status-pending'
  },

  lifetimes: {
    attached() {
      const info = this.properties.batchInfo || {}
      this.setData({
        batchName: info.name || '',
        variety: info.variety || '',
        plotName: info.plotName || '',
        timelineList: this.properties.timeline || [],
        statusClass: this.properties.chainStatus === 'verified' ? 'status-verified' : (this.properties.chainStatus === 'failed' ? 'status-failed' : 'status-pending')
      })
    }
  },

  methods: {}
})
