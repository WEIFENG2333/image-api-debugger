export const openAiImagesProvider = {
  id: 'openai-images',
  label: 'OpenAI-compatible Images',
  supportsSend: true,
  endpoint(state) {
    return state.mode === 'generate' ? '/v1/images/generations' : '/v1/images/edits'
  },
  payload(state) {
    const data = {
      model: state.model,
      prompt: state.prompt,
      size: state.size,
      quality: state.quality,
      n: state.count,
      output_format: state.outputFormat,
      background: state.background,
    }
    if ((state.outputFormat === 'jpeg' || state.outputFormat === 'webp') && state.outputCompression !== '') {
      data.output_compression = Number(state.outputCompression)
    }
    if (state.mode !== 'generate' && state.inputFidelity) data.input_fidelity = state.inputFidelity
    return { ...data, ...state.extra }
  },
  async send(context) {
    const url = `${context.baseUrl}${this.endpoint(context.state)}`
    if (context.state.mode === 'generate') {
      const response = await fetch(url, {
        method: 'POST',
        signal: context.signal,
        headers: {
          Authorization: `Bearer ${context.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context.payload),
      })
      return parseResponse(response)
    }

    const form = new FormData()
    Object.entries(context.payload).forEach(([key, value]) => form.append(key, String(value)))
    context.files.forEach((item, index) => form.append('image', item.file, item.name || `source-${index + 1}.png`))
    if (context.maskBlob) form.append('mask', context.maskBlob, 'api-mask.png')

    const response = await fetch(url, {
      method: 'POST',
      signal: context.signal,
      headers: { Authorization: `Bearer ${context.apiKey}` },
      body: form,
    })
    return parseResponse(response)
  },
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
    throw error
  }
  return { status: response.status, body }
}
