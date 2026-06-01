import { parseOpenAIImagesResponse } from './openaiImages.js'

export const codexCliProxyProvider = {
  id: 'codex-cliproxy',
  label: 'Codex / CLIProxyAPI',
  protocol: 'codex-cliproxy',
  defaultBaseUrl: 'http://127.0.0.1:18317',
  defaultModel: 'gpt-image-2',
  supportsSend: true,
  supportsMask: true,
  supportsCount: false,
  description: 'Codex OAuth via CLIProxyAPI',
  modelOptions: ['gpt-image-2', 'custom'],
  endpoint(state) {
    return state.mode === 'generate' ? '/v1/images/generations' : '/v1/images/edits'
  },
  payload(state) {
    const data = {
      model: state.model,
      prompt: state.prompt,
      size: state.size,
      quality: state.quality,
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
      return parseOpenAIImagesResponse(response)
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
    return parseOpenAIImagesResponse(response)
  },
}
