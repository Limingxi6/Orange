export default class WxCanvas {
  constructor(ctx, canvasId, isNew, canvasNode) {
    this.ctx = ctx
    this.canvasId = canvasId
    this.chart = null
    this.isNew = isNew
    if (isNew) {
      this.canvasNode = canvasNode
    }
  }

  getContext(contextType) {
    if (contextType === '2d') {
      return this.ctx
    }
  }

  setChart(chart) {
    this.chart = chart
  }

  get width() {
    if (this.canvasNode) return this.canvasNode.width
    return 0
  }

  set width(w) {
    if (this.canvasNode) this.canvasNode.width = w
  }

  get height() {
    if (this.canvasNode) return this.canvasNode.height
    return 0
  }

  set height(h) {
    if (this.canvasNode) this.canvasNode.height = h
  }

  addEventListener() {}
  removeEventListener() {}

  attachEvent() {}
  detachEvent() {}

  createElement(nodeName) {
    if (nodeName === 'canvas') {
      return new WxCanvas(this.ctx, this.canvasId, this.isNew, this.canvasNode)
    }
    return this.createImage()
  }

  createImage() {
    if (this.canvasNode) {
      return this.canvasNode.createImage()
    }
    return {}
  }
}
