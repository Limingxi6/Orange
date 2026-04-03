const batchService = require('../../services/batch')

const RULES = {
  name:      { required: true, label: '批次名称' },
  variety:   { required: true, label: '品种' },
  plotName:  { required: true, label: '地块' },
  area:      { required: true, label: '面积', isNumber: true },
  plantDate: { required: true, label: '种植日期' }
}

Page({
  data: {
    name: '',
    variety: '',
    plotName: '',
    area: '',
    plantDate: '',
    submitting: false
  },

  onFieldChange(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail })
  },

  onDateChange(e) {
    this.setData({ plantDate: e.detail.value })
  },

  _validate() {
    const data = this.data
    for (const [key, rule] of Object.entries(RULES)) {
      const val = (data[key] || '').toString().trim()
      if (rule.required && !val) {
        return `请填写${rule.label}`
      }
      if (rule.isNumber && val) {
        const num = Number(val)
        if (isNaN(num) || num <= 0) {
          return `${rule.label}请输入大于0的数字`
        }
      }
    }
    return ''
  },

  async onSubmit() {
    if (this.data.submitting) return

    const errMsg = this._validate()
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' })
      return
    }

    const { name, variety, plotName, area, plantDate } = this.data
    const payload = {
      name: name.trim(),
      variety: variety.trim(),
      plotName: plotName.trim(),
      area: Number(area),
      plantDate
    }

    this.setData({ submitting: true })
    try {
      await batchService.create(payload)
      wx.showToast({ title: '创建成功', icon: 'success' })
      setTimeout(() => {
        const pages = getCurrentPages()
        const prevPage = pages[pages.length - 2]
        if (prevPage && prevPage.fetchList) {
          prevPage.fetchList()
        }
        wx.navigateBack()
      }, 800)
    } catch (err) {
      if (!err._toasted) {
        wx.showToast({ title: err.message || '创建失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ submitting: false })
    }
  }
})
