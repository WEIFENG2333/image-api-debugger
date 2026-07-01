export function imageMeta(file, url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({
      file,
      url,
      name: file.name || 'image.png',
      bytes: file.size,
      width: image.naturalWidth,
      height: image.naturalHeight,
    })
    image.onerror = () => resolve({
      file,
      url,
      name: file.name || 'image.png',
      bytes: file.size,
      width: 0,
      height: 0,
    })
    image.src = url
  })
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

export function canvasBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export function canvasDataUrl(canvas, type = 'image/webp', quality = .76) {
  try {
    return canvas.toDataURL(type, quality)
  } catch {
    return canvas.toDataURL('image/png')
  }
}

export function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function dataUrlFile(dataUrl, name = 'image.png') {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], name, { type: blob.type || 'image/png' })
}

export async function normalizeImageFile(file, width, height, name = 'source.png') {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    const blob = await canvasBlob(canvas, 'image/png')
    return new File([blob], name, { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function blobImageSize(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    return { width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function resizeMaskFile(file, width, height) {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    return canvasBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function alphaMaskFromPaintCanvas(canvas, width, height) {
  let sourceCanvas = canvas
  if (canvas.width !== width || canvas.height !== height) {
    sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = width
    sourceCanvas.height = height
    sourceCanvas.getContext('2d').drawImage(canvas, 0, 0, width, height)
  }
  const source = sourceCanvas.getContext('2d').getImageData(0, 0, width, height)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  const image = ctx.createImageData(width, height)
  let painted = 0
  for (let i = 0; i < source.data.length; i += 4) {
    const selected = source.data[i + 3] > 0
    if (selected) painted += 1
    image.data[i] = 255
    image.data[i + 1] = 255
    image.data[i + 2] = 255
    image.data[i + 3] = selected ? 0 : 255
  }
  if (!painted) throw new Error('Mask is empty. Paint an edit region first.')
  ctx.putImageData(image, 0, 0)
  return canvasBlob(out)
}

export function responseImages(body, outputFormat = 'png') {
  const openAiImages = (body?.data || []).map((item) => {
    if (item.b64_json) return `data:image/${outputFormat};base64,${item.b64_json}`
    if (item.url) return item.url
    return ''
  }).filter(Boolean)
  const geminiImages = (body?.candidates || []).flatMap((candidate) => {
    return (candidate?.content?.parts || []).map((part) => {
      const inline = part.inlineData || part.inline_data
      if (!inline?.data) return ''
      const mime = inline.mimeType || inline.mime_type || 'image/png'
      return `data:${mime};base64,${inline.data}`
    })
  }).filter(Boolean)
  return [...openAiImages, ...geminiImages]
}

export async function imageThumbnail(url, maxSize = 180) {
  const image = await loadImage(url)
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || maxSize, image.naturalHeight || maxSize))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((image.naturalWidth || maxSize) * scale))
  canvas.height = Math.max(1, Math.round((image.naturalHeight || maxSize) * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvasDataUrl(canvas)
}

export async function imageInfo(url) {
  const image = await loadImage(url)
  return {
    width: image.naturalWidth || 0,
    height: image.naturalHeight || 0,
    aspectRatio: aspectRatioLabel(image.naturalWidth || 0, image.naturalHeight || 0),
  }
}

export async function imageInfos(urls) {
  return Promise.all(urls.map(async (url) => {
    try {
      return await imageInfo(url)
    } catch {
      return { width: 0, height: 0, aspectRatio: '-' }
    }
  }))
}

export function aspectRatioLabel(width, height) {
  if (!width || !height) return '-'
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b]
  return a || 1
}

export async function imageThumbnails(urls, maxSize = 180) {
  return Promise.all(urls.map(async (url) => {
    try {
      return await imageThumbnail(url, maxSize)
    } catch {
      return ''
    }
  }))
}
