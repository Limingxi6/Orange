import WxCanvas from './wx-canvas'
import * as echarts from './echarts'

let ctx

function compareVersion(v1, v2) {
  v1 = v1.split('.')
  v2 = v2.split('.')
  const len = Math.max(v1.length, v2.length)
  while (v1.length < len) v1.push('0')
  while (v2.length < len) v2.push('0')
  for (let i = 0; i < len; i++) {
    const num1 = parseInt(v1[i])
    const num2 = parseInt(v2[i])
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

Component({
  properties: {
    canvasId: { type: String, value: 'ec-canvas' },
    ec: { type: Object }
  },

  data: {
    isUseNewCanvas: true
  },

  ready() {
    const version = wx.getSystemInfoSync().SDKVersion
    const canUseNewCanvas = compareVersion(version, '2.9.0') >= 0
    this.setData({ isUseNewCanvas: canUseNewCanvas })

    if (!this.data.ec) {
      console.warn('[ec-canvas] bindec 属性未传入')
      return
    }
    if (canUseNewCanvas) {
      this.initByNewWay()
    } else {
      this.initByOldWay()
    }
  },

  methods: {
    initByNewWay() {
      const query = this.createSelectorQuery()
      query.select(`#${this.data.canvasId}`)
        .fields({ node: true, size: true })
        .exec(res => {
          if (!res || !res[0] || !res[0].node) return
          const canvasNode = res[0].node
          this.canvasNode = canvasNode
          const canvasDpr = wx.getSystemInfoSync().pixelRatio
          const canvasWidth = res[0].width
          const canvasHeight = res[0].height

          const canvasCtx = canvasNode.getContext('2d')
          const canvas = new WxCanvas(canvasCtx, this.data.canvasId, true, canvasNode)
          echarts.setCanvasCreator(() => canvas)

          if (this.data.ec && typeof this.data.ec.onInit === 'function') {
            this.chart = this.data.ec.onInit(canvas, canvasWidth, canvasHeight, canvasDpr)
          }
        })
    },

    initByOldWay() {
      ctx = wx.createCanvasContext(this.data.canvasId, this)
      const canvas = new WxCanvas(ctx, this.data.canvasId, false)

      echarts.setCanvasCreator(() => canvas)
      const canvasDpr = 1
      const query = this.createSelectorQuery()
      query.select(`#${this.data.canvasId || 'ec-canvas'}`)
        .boundingClientRect(res => {
          if (!res) return
          if (this.data.ec && typeof this.data.ec.onInit === 'function') {
            this.chart = this.data.ec.onInit(canvas, res.width, res.height, canvasDpr)
          }
        }).exec()
    },

    canvasToTempFilePath(opt) {
      if (this.data.isUseNewCanvas) {
        const query = this.createSelectorQuery()
        query.select(`#${this.data.canvasId}`)
          .fields({ node: true, size: true })
          .exec(res => {
            const canvasNode = res[0].node
            opt.canvas = canvasNode
            wx.canvasToTempFilePath(opt)
          })
      } else {
        opt.canvasId = this.data.canvasId
        ctx.draw(true, () => {
          wx.canvasToTempFilePath(opt, this)
        })
      }
    },

    touchStart(e) {
      if (this.chart && e.touches && e.touches.length > 0) {
        const touch = e.touches[0]
        const handler = this.chart.getZr().handler
        handler.dispatch('mousedown', {
          zrX: touch.x, zrY: touch.y
        })
        handler.dispatch('mousemove', {
          zrX: touch.x, zrY: touch.y
        })
        handler.processGesture(wrapTouch(e), 'start')
      }
    },

    touchMove(e) {
      if (this.chart && e.touches && e.touches.length > 0) {
        const touch = e.touches[0]
        const handler = this.chart.getZr().handler
        handler.dispatch('mousemove', {
          zrX: touch.x, zrY: touch.y
        })
        handler.processGesture(wrapTouch(e), 'change')
      }
    },

    touchEnd(e) {
      if (this.chart) {
        const touch = e.changedTouches ? e.changedTouches[0] : {}
        const handler = this.chart.getZr().handler
        handler.dispatch('mouseup', {
          zrX: touch.x, zrY: touch.y
        })
        handler.dispatch('click', {
          zrX: touch.x, zrY: touch.y
        })
        handler.processGesture(wrapTouch(e), 'end')
      }
    }
  }
})

function wrapTouch(event) {
  for (let i = 0; i < event.touches.length; ++i) {
    const touch = event.touches[i]
    touch.offsetX = touch.x
    touch.offsetY = touch.y
  }
  return event
}
