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
  const source = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
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
  return (body?.data || []).map((item) => {
    if (item.b64_json) return `data:image/${outputFormat};base64,${item.b64_json}`
    if (item.url) return item.url
    return ''
  }).filter(Boolean)
}
