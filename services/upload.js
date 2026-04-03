const { uploadFile, mockResolve, tryReal } = require('./request')

function normalizeUploadData(data, fallbackPath) {
  if (typeof data === 'string') {
    return { url: data, fileName: '', originalName: '' }
  }
  const safe = data || {}
  return {
    url: safe.url || safe.fileUrl || safe.accessUrl || fallbackPath || '',
    fileName: safe.fileName || '',
    originalName: safe.originalName || '',
    ...safe
  }
}

function uploadImage(filePath) {
  return tryReal(
    () => uploadFile({
      url: '/api/upload/image',
      filePath,
      name: 'file'
    }).then((res) => normalizeUploadData(res, filePath)),
    () => mockResolve(normalizeUploadData({ url: filePath }, filePath), 500)
  )
}

module.exports = {
  uploadImage
}
