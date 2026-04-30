Component({
  properties: {
    level: {
      type: String,
      value: '低'
    },
    reason: {
      type: String,
      value: ''
    },
    suggestion: {
      type: String,
      value: ''
    }
  },

  data: {
    levelClass: ''
  },

  observers: {
    'level': function(level) {
      const levelMap = {
        '低': 'risk-low',
        '中': 'risk-medium',
        '高': 'risk-high'
      }
      this.setData({
        levelClass: levelMap[level] || 'risk-low'
      })
    }
  },

  attached() {
    const levelMap = {
      '低': 'risk-low',
      '中': 'risk-medium',
      '高': 'risk-high'
    }
    this.setData({
      levelClass: levelMap[this.properties.level] || 'risk-low'
    })
  }
})
