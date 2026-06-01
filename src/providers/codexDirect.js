const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'
const TOKEN_URL = 'https://auth.openai.com/oauth/token'
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const COORDINATOR_MODEL = 'gpt-5.4-mini'
const DEFAULT_USER_AGENT = 'codex-tui/0.135.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.135.0)'

export const codexDirectProvider = {
  id: 'codex-direct',
  label: 'Codex Direct',
  protocol: 'codex-direct',
  defaultBaseUrl: CODEX_BASE_URL,
  defaultModel: 'gpt-image-2',
  supportsSend: true,
  supportsMask: true,
  supportsCount: false,
  usesCodexAuthJson: true,
  description: 'Browser-side Codex OAuth',
  modelOptions: ['gpt-image-2', 'custom'],
  endpoint() {
    return '/responses'
  },
  payload(state) {
    return buildResponsesRequest(state, [])
  },
  async send(context) {
    let auth = parseCodexAuth(context.codexAuthJson)
    if (shouldRefresh(auth)) {
      auth = await refreshCodexAuth(auth, context.signal)
      context.onCodexAuthUpdate?.(JSON.stringify(auth.raw, null, 2))
    }

    const files = await Promise.all(context.files.map(async (item) => fileDataUrl(item.file)))
    const body = buildResponsesRequest(context.state, files, context.maskBlob ? await blobDataUrl(context.maskBlob) : '')
    const headers = {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Originator: 'codex_cli_rs',
    }
    if (auth.accountId) headers['Chatgpt-Account-Id'] = auth.accountId

    const response = await fetch(`${context.baseUrl || CODEX_BASE_URL}/responses`, {
      method: 'POST',
      signal: context.signal,
      headers,
      body: JSON.stringify(body),
    })
    return parseCodexImagesResponse(response, context.state.outputFormat)
  },
}

export function parseCodexAuth(rawText) {
  let raw
  try {
    raw = JSON.parse(String(rawText || '').trim())
  } catch {
    throw new Error('Codex auth JSON is invalid.')
  }
  const tokens = raw.tokens && typeof raw.tokens === 'object' ? raw.tokens : raw
  const accessToken = stringValue(tokens.access_token)
  const refreshToken = stringValue(tokens.refresh_token)
  const idToken = stringValue(tokens.id_token)
  const accountId = stringValue(tokens.account_id) || accountIdFromJwt(idToken)
  const expired = stringValue(tokens.expired) || stringValue(raw.expired)
  if (!accessToken && !refreshToken) throw new Error('Codex auth JSON must include access_token or refresh_token.')
  return {
    raw,
    accessToken,
    refreshToken,
    idToken,
    accountId,
    expired,
    userAgent: stringValue(raw.user_agent) || stringValue(raw.userAgent) || DEFAULT_USER_AGENT,
  }
}

function shouldRefresh(auth) {
  if (!auth.accessToken) return true
  if (!auth.refreshToken || !auth.expired) return false
  const expiresAt = Date.parse(auth.expired)
  if (!Number.isFinite(expiresAt)) return false
  return Date.now() + 120_000 > expiresAt
}

async function refreshCodexAuth(auth, signal) {
  if (!auth.refreshToken) throw new Error('Codex refresh_token is missing.')
  const form = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    scope: 'openid profile email',
  })
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text }
  }
  if (!response.ok) {
    const error = new Error(body?.error_description || body?.error || body?.raw || `Token refresh failed: HTTP ${response.status}`)
    error.status = response.status
    error.body = body
    error.headers = responseHeaders(response)
    throw error
  }
  const expiresAt = new Date(Date.now() + Number(body.expires_in || 0) * 1000).toISOString()
  const next = {
    type: 'codex',
    id_token: body.id_token || auth.idToken,
    access_token: body.access_token || auth.accessToken,
    refresh_token: body.refresh_token || auth.refreshToken,
    account_id: accountIdFromJwt(body.id_token) || auth.accountId,
    expired: expiresAt,
    last_refresh: new Date().toISOString(),
    user_agent: auth.userAgent || DEFAULT_USER_AGENT,
  }
  return parseCodexAuth(JSON.stringify(next))
}

function buildResponsesRequest(state, imageDataUrls = [], maskDataUrl = '') {
  const tool = buildImageTool(state, maskDataUrl)
  const content = [{ type: 'input_text', text: state.prompt }]
  for (const imageUrl of imageDataUrls) content.push({ type: 'input_image', image_url: imageUrl })
  return {
    model: COORDINATOR_MODEL,
    instructions: '',
    stream: true,
    reasoning: { effort: 'medium', summary: 'auto' },
    parallel_tool_calls: true,
    include: ['reasoning.encrypted_content'],
    store: false,
    tool_choice: { type: 'image_generation' },
    tools: [tool],
    input: [{ type: 'message', role: 'user', content }],
  }
}

function buildImageTool(state, maskDataUrl = '') {
  const tool = {
    type: 'image_generation',
    action: state.mode === 'generate' ? 'generate' : 'edit',
    model: state.model || 'gpt-image-2',
  }
  for (const key of ['size', 'quality', 'background', 'outputFormat', 'inputFidelity']) {
    const apiKey = key === 'outputFormat' ? 'output_format' : key === 'inputFidelity' ? 'input_fidelity' : key
    const value = state[key]
    if (value) tool[apiKey] = value
  }
  if ((state.outputFormat === 'jpeg' || state.outputFormat === 'webp') && state.outputCompression !== '') {
    tool.output_compression = Number(state.outputCompression)
  }
  if (maskDataUrl) tool.input_image_mask = { image_url: maskDataUrl }
  return { ...tool, ...state.extra }
}

async function parseCodexImagesResponse(response, outputFormat = 'png') {
  const text = await response.text()
  const headers = responseHeaders(response)
  if (!response.ok) {
    const body = parseMaybeJson(text)
    const error = new Error(body?.error?.message || body?.message || body?.raw || `HTTP ${response.status}`)
    error.status = response.status
    error.body = body
    error.headers = headers
    throw error
  }
  const completed = responseCompletedEvent(text)
  if (!completed) {
    return { status: response.status, body: { raw: text }, headers }
  }
  return { status: response.status, body: imagesApiResponse(completed, outputFormat), headers }
}

function responseCompletedEvent(sseText) {
  for (const event of parseSseEvents(sseText)) {
    if (event.type === 'response.completed') return event
  }
  return null
}

function imagesApiResponse(completed, fallbackFormat) {
  const response = completed.response || {}
  const images = (response.output || []).filter((item) => item?.type === 'image_generation_call' && item.result)
  const first = images[0] || {}
  const format = first.output_format || fallbackFormat || 'png'
  const body = {
    created: response.created_at || Math.floor(Date.now() / 1000),
    data: images.map((item) => ({
      b64_json: item.result,
      ...(item.revised_prompt ? { revised_prompt: item.revised_prompt } : {}),
    })),
    ...(response.tool_usage?.image_gen ? { usage: response.tool_usage.image_gen } : response.usage ? { usage: response.usage } : {}),
  }
  for (const key of ['background', 'quality', 'size']) if (first[key]) body[key] = first[key]
  body.output_format = format
  return body
}

function parseSseEvents(text) {
  const events = []
  for (const block of String(text || '').split(/\n\n+/)) {
    const lines = block.split(/\r?\n/)
    let type = ''
    const data = []
    for (const line of lines) {
      if (line.startsWith('event:')) type = line.slice(6).trim()
      if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    const raw = data.join('\n')
    if (!raw || raw === '[DONE]') continue
    const parsed = parseMaybeJson(raw)
    if (parsed && typeof parsed === 'object') events.push({ type: type || parsed.type, ...parsed })
  }
  return events
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

function responseHeaders(response) {
  return Object.fromEntries(Array.from(response.headers.entries()).filter(([key]) => !['authorization'].includes(key.toLowerCase())))
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function blobDataUrl(blob) {
  return fileDataUrl(blob)
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function accountIdFromJwt(token) {
  const payload = jwtPayload(token)
  return stringValue(payload?.https?.['api.openai.com/auth']?.chatgpt_account_id) ||
    stringValue(payload?.['https://api.openai.com/auth']?.chatgpt_account_id) ||
    stringValue(payload?.chatgpt_account_id)
}

function jwtPayload(token) {
  const part = String(token || '').split('.')[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(Array.from(atob(base64)).map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))
    return JSON.parse(json)
  } catch {
    return null
  }
}
