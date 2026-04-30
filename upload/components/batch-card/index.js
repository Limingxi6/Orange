Component({
  properties: {
    name: {
      type: String,
      value: ''
    },
    variety: {
      type: String,
      value: ''
    },
    stage: {
      type: String,
      value: ''
    },
    status: {
      type: String,
      value: ''
    },
    plantDate: {
      type: String,
      value: ''
    }
  },

  data: {
    statusClass: ''
  },

  observers: {
    'status': function(status) {
      const statusMap = {
        '正常': 'status-normal',
        '待处理': 'status-pending',
        '异常': 'status-abnormal',
        '已完成': 'status-done'
      }
      this.setData({
        statusClass: statusMap[status] || 'status-normal'
      })
    }
  },

  attached() {
    const statusMap = {
      '正常': 'status-normal',
      '待处理': 'status-pending',
      '异常': 'status-abnormal',
      '已完成': 'status-done'
    }
    this.setData({
      statusClass: statusMap[this.properties.status] || 'status-normal'
    })
  }
})
