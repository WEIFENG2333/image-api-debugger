export const geminiNativeProvider = {
  id: 'gemini-native',
  label: 'Gemini',
  protocol: 'gemini',
  defaultBaseUrl: 'https://generativelanguage.googleapis.com',
  defaultModel: 'gemini-3.1-flash-image',
  supportsSend: true,
  supportsMask: false,
  modelOptions: [
    { value: 'gemini-3.1-flash-image', label: 'NanoPanda 2 / Gemini 3.1 Flash Image' },
    { value: 'gemini-3-pro-image', label: 'Nano Banana Pro / Gemini 3 Pro Image' },
    { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview' },
    { value: 'gemini-2.5-flash-image', label: 'Nano Banana / Gemini 2.5 Flash Image' },
    'custom',
  ],
  sizeOptions: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
  qualityOptions: ['1K', '2K', '4K', '512'],
  endpoint(state) {
    return `/v1beta/models/${encodeURIComponent(state.model)}:generateContent`
  },
  payload(state) {
    const generationConfig = {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: aspectRatio(state.size),
        imageSize: imageSize(state.quality),
      },
    }
    return {
      contents: [{
        role: 'user',
        parts: [
          { text: state.prompt },
          ...state.files.map((file) => ({
            inline_data: {
              mime_type: file.type || 'image/png',
              data: `[base64 image omitted: ${file.bytes.toLocaleString()} bytes source file]`,
            },
          })),
        ],
      }],
      generationConfig,
      ...state.extra,
    }
  },
  async send(context) {
    const state = context.state
    const body = this.payload({ ...state, files: [] })
    body.contents[0].parts = [
      { text: state.prompt },
      ...(await Promise.all(context.files.map(async (item) => ({
        inline_data: {
          mime_type: item.file.type || 'image/png',
          data: await fileBase64(item.file),
        },
      })))),
    ]
    const response = await fetch(`${context.baseUrl}${this.endpoint(state)}`, {
      method: 'POST',
      signal: context.signal,
      headers: {
        'x-goog-api-key': context.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    return parseResponse(response)
  },
  estimateCost(state) {
    const prices = geminiImagePrices(state.model)
    if (!prices) return 0
    const size = imageSize(state.quality)
    if (state.model.includes('2.5-flash-image')) return .039
    if (state.model.includes('3.1-flash-image')) return ({ '512': .045, '1K': .067, '2K': .101, '4K': .151 }[size] || .067)
    if (state.model.includes('3-pro-image')) return size === '4K' ? .24 : .134
    return 0
  },
  usageCost(body, model) {
    const usage = body?.usageMetadata
    const prices = geminiImagePrices(model)
    if (!usage || !prices) return { label: 'usage not returned', value: null, usage: null }
    const promptTokens = Number(usage.promptTokenCount || 0)
    const outputTokens = Number(usage.candidatesTokenCount || 0)
    const thoughtsTokens = Number(usage.thoughtsTokenCount || 0)
    const imageOutputTokens = tokenCountForModality(usage.candidatesTokensDetails, 'IMAGE')
    const textOutputTokens = Math.max(0, outputTokens - imageOutputTokens)
    const cost = (
      promptTokens * prices.input +
      imageOutputTokens * prices.imageOutput +
      (textOutputTokens + thoughtsTokens) * prices.textOutput
    ) / 1_000_000
    return {
      label: `$${cost.toFixed(6)}`,
      value: cost,
      usage: { promptTokens, imageOutputTokens, textOutputTokens, thoughtsTokens },
    }
  },
}

function aspectRatio(size) {
  if (['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'].includes(size)) return size
  if (size === '1536x1024') return '3:2'
  if (size === '1024x1536') return '2:3'
  return '1:1'
}

function imageSize(quality) {
  if (['512', '1K', '2K', '4K'].includes(quality)) return quality
  if (quality === 'high') return '2K'
  return '1K'
}

function geminiImagePrices(model) {
  if (model.includes('2.5-flash-image')) return { input: .30, textOutput: 0, imageOutput: 30 }
  if (model.includes('3.1-flash-image')) return { input: .50, textOutput: 3, imageOutput: 60 }
  if (model.includes('3-pro-image')) return { input: 2, textOutput: 12, imageOutput: 120 }
  return null
}

function tokenCountForModality(details = [], modality) {
  return (details || []).filter((item) => item.modality === modality).reduce((sum, item) => sum + Number(item.tokenCount || 0), 0)
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function parseResponse(response) {
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text }
  }
  if (!response.ok) {
    const error = new Error(body?.error?.message || `HTTP ${response.status}`)
    error.status = response.status
    error.body = body
    error.headers = responseHeaders(response)
    throw error
  }
  return { status: response.status, body, headers: responseHeaders(response) }
}

function responseHeaders(response) {
  return Object.fromEntries(Array.from(response.headers.entries()).filter(([key]) => !['authorization', 'x-goog-api-key'].includes(key.toLowerCase())))
}
