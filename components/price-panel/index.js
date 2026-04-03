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
          factorList = val
        } else if (typeof val === 'object') {
          factorList = Object.keys(val).map(key => ({ name: key, value: val[key] }))
        }
      }
      this.setData({ factorList })
    }
  }
})
