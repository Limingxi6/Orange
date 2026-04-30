Component({
  properties: {
    logs: {
      type: Array,
      value: [],
      observer(newVal) {
        this.setData({ list: newVal || [] })
      }
    }
  },

  data: {
    list: []
  },

  lifetimes: {
    attached() {
      this.setData({ list: this.properties.logs || [] })
    }
  },

  methods: {
    onItemTap(e) {
      const index = e.currentTarget.dataset.index
      const item = this.data.list[index]
      if (item) {
        this.triggerEvent('itemtap', { item, index })
      }
    },

    onImagePreview(e) {
      const { urls, current } = e.currentTarget.dataset
      wx.previewImage({ current, urls })
    }
  }
})
