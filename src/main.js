import './styles.css'
import { providerById, providers } from './providers/index.js'
import { alphaMaskFromPaintCanvas, blobImageSize, dataUrlFile, fileDataUrl, imageMeta, imageThumbnails, normalizeImageFile, resizeMaskFile, responseImages } from './lib/images.js'
import { clearRuns, listRuns, loadConfig, saveConfig, saveRun } from './lib/storage.js'

const app = document.querySelector('#app')

const state = {
  mode: 'generate',
  providerId: 'openai-images',
  files: [],
  maskFile: null,
  maskReady: false,
  maskTool: 'paint',
  runs: [],
  controller: null,
  customSelects: new Map(),
  rawResponseText: '{}',
  rawHeadersText: '{}',
  lastPoint: null,
  workspaceSaveTimer: null,
  hydratingWorkspace: false,
  connections: {},
}

const icons = {
  chevronDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  chevronUp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
  database: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M7 3v6h9"/><path d="M7 21v-8h10v8"/></svg>',
  upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M20 16v4H4v-4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><rect x="4" y="4" width="11" height="11" rx="2"/></svg>',
  mask: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14c4-8 12-8 16 0"/><path d="M7 14c1.2 2 2.8 3 5 3s3.8-1 5-3"/><path d="M9 14h.01"/><path d="M15 14h.01"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
  brush: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6-9 9H5v-6Z"/><path d="m14 4 2-2 6 6-2 2"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 21-4-4 11-11 7 7-8 8Z"/><path d="m14 6 4 4"/><path d="M5 21h14"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
}

function setButtonBusy(button, busy, label = '') {
  button.classList.toggle('is-loading', busy)
  button.toggleAttribute('aria-busy', busy)
  button.disabled = busy
  if (label) button.dataset.busyLabel = label
}

function flashButton(button, kind = 'done') {
  button.classList.remove('flash-done', 'flash-warn')
  button.classList.add(kind === 'warn' ? 'flash-warn' : 'flash-done')
  window.setTimeout(() => button.classList.remove('flash-done', 'flash-warn'), 700)
}

app.innerHTML = `
  <div class="app">
    <main class="layout">
      <section class="column">
        <section class="identity">
          <div class="wordmark"><span class="mark">id</span><span>Image API Debugger</span></div>
          <div class="status"><span id="statusDot" class="dot"></span><span id="statusText">Ready</span></div>
        </section>

        <section class="provider-strip">
          <div class="provider-current">
            <span>Provider</span>
            <strong id="providerCurrentLabel">GPT / OpenAI Images</strong>
          </div>
          <div class="provider-actions">
            <span id="providerStatus" class="connection-pill idle">Not tested</span>
            <button id="providerMenuBtn" class="icon-btn" title="Switch provider" aria-label="Switch provider">${icons.chevronDown}</button>
          </div>
          <div id="providerMenu" class="provider-menu hidden">
            ${providers.map((p) => `<button class="provider-choice ${p.id === 'openai-images' ? 'active' : ''}" data-provider="${p.id}"><strong>${p.label}</strong><span>${p.protocol === 'gemini' ? 'Native generateContent' : 'Images API compatible'}</span></button>`).join('')}
          </div>
          <select id="provider" class="hidden">${providers.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}</select>
        </section>

        <section id="connectorCard" class="card">
          <div class="card-head">
            <h2 id="connectorTitle">GPT connection</h2>
            <div class="head-actions">
              <button id="testModelsBtn" class="icon-btn" title="Load models" aria-label="Load models">${icons.database}</button>
              <button id="toggleConnectorBtn" class="icon-btn" title="Expand connector" aria-label="Expand connector">${icons.chevronDown}</button>
            </div>
          </div>
          <div class="card-body">
            <div class="field"><label>Base URL</label><input id="baseUrl" value="https://api.videocaptioner.cn"></div>
            <div class="field"><label>API key</label><input id="apiKey" type="password" placeholder="sk-..."></div>
            <div id="connectionDetail" class="connection-detail">Connection has not been tested.</div>
            <div class="icon-row">
              <button id="saveWorkspaceBtn" class="btn subtle">${icons.save}<span>Save workspace</span></button>
              <button id="loadModelsBtn" class="btn subtle">${icons.database}<span>Load models</span></button>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Parameters</h2><span id="estimate" class="label">$0.053 est.</span></div>
          <div class="card-body">
            <div class="field">
              <label>Mode</label>
              <div class="segment">
                <button class="mode active" data-mode="generate">Generate</button>
                <button class="mode" data-mode="edit">Edit</button>
                <button class="mode" data-mode="mask">Mask</button>
              </div>
            </div>
            <div class="field"><label>Model</label><select id="model"><option>gpt-image-2</option><option>gpt-image-1.5</option><option>gpt-image-1</option><option>gpt-image-1-mini</option><option>doubao-seedream-4-0-250828</option><option value="custom">Custom...</option></select></div>
            <div id="customModelWrap" class="field hidden"><label>Custom model</label><input id="customModel"></div>
            <div class="grid-2">
              <div class="field"><label id="sizeLabel">Size</label><select id="size"><option>1024x1024</option><option>1536x1024</option><option>1024x1536</option><option>auto</option><option value="custom">custom</option></select></div>
              <div class="field"><label id="qualityLabel">Quality</label><select id="quality"><option>low</option><option selected>medium</option><option>high</option><option>auto</option></select></div>
            </div>
            <div id="customSizeWrap" class="grid-2 hidden">
              <div class="field"><label>Width</label><input id="customWidth" type="number" min="1" max="4096" value="1024"></div>
              <div class="field"><label>Height</label><input id="customHeight" type="number" min="1" max="4096" value="1024"></div>
            </div>
            <div id="formatCountRow" class="grid-2">
              <div class="field"><label>Format</label><select id="outputFormat"><option>png</option><option>jpeg</option><option>webp</option></select></div>
              <div class="field"><label>n</label><input id="count" type="number" min="1" max="4" value="1"></div>
            </div>
            <div id="backgroundCompressionRow" class="grid-2">
              <div class="field"><label>Background</label><select id="background"><option>auto</option><option>opaque</option><option>transparent</option></select></div>
              <div class="field"><label>Compression</label><input id="outputCompression" type="number" min="0" max="100" value="90"></div>
            </div>
            <div id="inputFidelityRow" class="field"><label>Input fidelity</label><select id="inputFidelity"><option value="">Default</option><option value="high">high</option></select></div>
            <div class="field"><label>Extra JSON parameters</label><textarea id="extraJson" spellcheck="false" placeholder='{"moderation":"auto"}'></textarea></div>
            <div id="warnings" class="warning"></div>
          </div>
        </section>
      </section>

      <section class="column">
        <section class="card">
          <div class="card-head"><h2>Prompt</h2><span id="endpointHint" class="label">POST /v1/images/generations</span></div>
          <div class="card-body"><textarea id="prompt">A clean ecommerce product photo of a ceramic coffee mug labeled LOCAL BREW, warm studio light, realistic product photography.</textarea></div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Source images</h2><span id="sourceHint" class="label">Optional for generate</span></div>
          <div class="card-body">
            <label class="file-zone">
              <input id="sourceInput" type="file" accept="image/*" multiple>
              <span class="file-button">${icons.upload}<strong>Choose images</strong><span>Edit/Mask uses these as multipart image files</span></span>
            </label>
            <div id="fileList" class="file-list"></div>
          </div>
        </section>

        <section id="maskCard" class="card mask-card">
          <div class="card-head">
            <h2>Mask workflow</h2>
            <div class="head-actions">
              <button id="makeMaskBtn" class="btn primary">${icons.mask}<span>Canvas</span></button>
              <button id="downloadMaskBtn" class="icon-btn" title="Download mask" aria-label="Download mask">${icons.download}</button>
            </div>
          </div>
          <div class="card-body">
            <div class="metrics">
              <div class="metric"><span>Source</span><strong id="sourceMetric">-</strong></div>
              <div class="metric"><span>Drawn mask</span><strong id="maskMetric">-</strong></div>
              <div class="metric"><span>API mask</span><strong id="apiMaskMetric">-</strong></div>
            </div>
            <div class="mask-tools">
              <button id="paintBtn" class="tool active">${icons.brush}<span>Paint</span></button>
              <button id="eraseBtn" class="tool">${icons.eraser}<span>Erase</span></button>
              <button id="clearMaskBtn" class="tool">${icons.close}<span>Clear</span></button>
            </div>
            <div class="brush-panel">
              <span>Brush size</span>
              <button id="brushDownBtn" class="icon-btn" title="Smaller brush" aria-label="Smaller brush">${icons.minus}</button>
              <input id="brushSize" type="range" min="6" max="180" value="48">
              <button id="brushUpBtn" class="icon-btn" title="Larger brush" aria-label="Larger brush">${icons.plus}</button>
              <input id="brushNumber" type="number" min="6" max="180" value="48">
            </div>
            <div id="maskEmpty" class="mask-empty">Upload a source image. The mask canvas will appear automatically.</div>
            <div class="mask-stage"><div class="mask-stack"><img id="maskImage" alt=""><canvas id="maskCanvas"></canvas></div></div>
            <label class="file-zone compact">
              <input id="maskInput" type="file" accept="image/*">
              <span class="file-button">${icons.upload}<strong>Import existing mask</strong><span>Optional. It will be resized to match the first source image.</span></span>
            </label>
          </div>
        </section>
      </section>

      <section class="column inspector-column">
        <section class="card inspector">
          <div class="inspector-bar">
            <div class="inspector-title">
              <span>Inspect</span>
              <small>request, response, proof</small>
            </div>
            <div class="command-bar">
              <button id="validateBtn" class="btn subtle" title="Validate request">${icons.check}<span>Validate</span></button>
              <button id="sendBtn" class="btn primary" title="Send request">${icons.send}<span>Send</span></button>
              <button id="abortBtn" class="btn danger" title="Abort request" disabled>${icons.stop}<span>Abort</span></button>
              <button id="clearRunsBtn" class="icon-btn" title="Clear history" aria-label="Clear history">${icons.trash}</button>
            </div>
          </div>
          <div class="tabs">
            <button class="tab active" data-tab="request">Request</button>
            <button class="tab" data-tab="response">Response</button>
            <button class="tab" data-tab="history">History</button>
            <button class="tab" data-tab="curl">cURL</button>
          </div>
          <div id="requestTab" class="tab-body">
            <div class="panel-toolbar"><span>Request JSON</span><button class="btn subtle compact" title="Copy JSON" data-copy="requestPreview">${icons.copy}<span>Copy</span></button></div>
            <pre id="requestPreview">{}</pre>
          </div>
          <div id="responseTab" class="tab-body response-body hidden">
            <div id="resultStage" class="result-stage empty">
              <div>No image yet</div>
            </div>
            <div id="proofs" class="proofs"></div>
            <details class="raw-panel">
              <summary><span>Raw response</span><button class="btn subtle compact" title="Copy response" data-copy="responsePreview">${icons.copy}<span>Copy</span></button></summary>
              <pre id="responsePreview">{}</pre>
            </details>
            <details class="raw-panel headers-panel">
              <summary><span>Response headers</span><button class="btn subtle compact" title="Copy headers" data-copy="headersPreview">${icons.copy}<span>Copy</span></button></summary>
              <pre id="headersPreview">{}</pre>
            </details>
          </div>
          <div id="historyTab" class="tab-body hidden"><div id="historyList" class="history"></div></div>
          <div id="curlTab" class="tab-body hidden">
            <div class="panel-toolbar"><span>cURL</span><button class="btn subtle compact" title="Copy cURL" data-copy="curlPreview">${icons.copy}<span>Copy</span></button></div>
            <pre id="curlPreview"></pre>
          </div>
        </section>
      </section>
    </main>
    <div id="toast" class="toast hidden" role="alert" aria-live="assertive">
      <button id="toastClose" class="icon-btn" title="Close" aria-label="Close">${icons.close}</button>
      <strong id="toastTitle">Check request</strong>
      <span id="toastMessage"></span>
    </div>
    <div id="lightbox" class="lightbox hidden" role="dialog" aria-modal="true" aria-label="Image preview">
      <div class="lightbox-bar">
        <div id="lightboxMeta" class="lightbox-meta">Preview</div>
        <div class="lightbox-actions">
          <button id="fitImageBtn" class="btn subtle">Fit</button>
          <button id="actualImageBtn" class="btn subtle">100%</button>
          <button id="zoomOutBtn" class="icon-btn" title="Zoom out" aria-label="Zoom out">${icons.minus}</button>
          <button id="zoomInBtn" class="icon-btn" title="Zoom in" aria-label="Zoom in">${icons.plus}</button>
          <button id="closeLightboxBtn" class="icon-btn" title="Close preview" aria-label="Close preview">${icons.close}</button>
        </div>
      </div>
      <div id="lightboxViewport" class="lightbox-viewport"><img id="lightboxImage" alt="Large preview"></div>
    </div>
  </div>
`

const $ = (id) => document.getElementById(id)
const els = {
  statusDot: $('statusDot'), statusText: $('statusText'), baseUrl: $('baseUrl'), apiKey: $('apiKey'),
  provider: $('provider'), model: $('model'), customModel: $('customModel'), customModelWrap: $('customModelWrap'),
  size: $('size'), customSizeWrap: $('customSizeWrap'), customWidth: $('customWidth'), customHeight: $('customHeight'),
  quality: $('quality'), outputFormat: $('outputFormat'), count: $('count'), background: $('background'),
  outputCompression: $('outputCompression'), inputFidelity: $('inputFidelity'), extraJson: $('extraJson'),
  prompt: $('prompt'), warnings: $('warnings'), endpointHint: $('endpointHint'), estimate: $('estimate'), sourceHint: $('sourceHint'),
  sizeLabel: $('sizeLabel'), qualityLabel: $('qualityLabel'), formatCountRow: $('formatCountRow'),
  backgroundCompressionRow: $('backgroundCompressionRow'), inputFidelityRow: $('inputFidelityRow'),
  providerStatus: $('providerStatus'), providerCurrentLabel: $('providerCurrentLabel'), providerMenu: $('providerMenu'),
  providerMenuBtn: $('providerMenuBtn'), connectorTitle: $('connectorTitle'), connectionDetail: $('connectionDetail'),
  sourceInput: $('sourceInput'), fileList: $('fileList'), maskCard: $('maskCard'), maskInput: $('maskInput'),
  makeMaskBtn: $('makeMaskBtn'), downloadMaskBtn: $('downloadMaskBtn'), maskImage: $('maskImage'), maskCanvas: $('maskCanvas'),
  sourceMetric: $('sourceMetric'), maskMetric: $('maskMetric'), apiMaskMetric: $('apiMaskMetric'),
  paintBtn: $('paintBtn'), eraseBtn: $('eraseBtn'), clearMaskBtn: $('clearMaskBtn'),
  brushSize: $('brushSize'), brushNumber: $('brushNumber'), brushDownBtn: $('brushDownBtn'), brushUpBtn: $('brushUpBtn'),
  requestPreview: $('requestPreview'), responsePreview: $('responsePreview'), headersPreview: $('headersPreview'),
  curlPreview: $('curlPreview'), historyList: $('historyList'), proofs: $('proofs'), resultStage: $('resultStage'),
  lightbox: $('lightbox'), lightboxImage: $('lightboxImage'), lightboxMeta: $('lightboxMeta'), lightboxViewport: $('lightboxViewport'),
  toast: $('toast'), toastTitle: $('toastTitle'), toastMessage: $('toastMessage'), toastClose: $('toastClose'),
}

function setStatus(text, type = '') {
  els.statusText.textContent = text
  els.statusDot.className = `dot ${type}`.trim()
}

function showToast(title, message, type = 'err') {
  els.toastTitle.textContent = title
  els.toastMessage.textContent = message
  els.toast.className = `toast ${type}`.trim()
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(hideToast, type === 'err' ? 9000 : 5200)
}

function hideToast() {
  els.toast.classList.add('hidden')
}

function connectionFor(providerId = els.provider.value) {
  const provider = providerById(providerId)
  return state.connections[providerId] || {
    baseUrl: provider.defaultBaseUrl || '',
    apiKey: '',
    status: 'idle',
    message: 'Connection has not been tested.',
    testedAt: '',
  }
}

function saveCurrentConnection() {
  const providerId = els.provider.value
  const current = connectionFor(providerId)
  state.connections[providerId] = {
    ...current,
    baseUrl: els.baseUrl.value,
    apiKey: els.apiKey.value,
  }
}

function applyConnection(providerId = els.provider.value) {
  const connection = connectionFor(providerId)
  els.baseUrl.value = connection.baseUrl
  els.apiKey.value = connection.apiKey
  renderConnectionStatus()
}

function setConnectionStatus(status, message) {
  const providerId = els.provider.value
  state.connections[providerId] = {
    ...connectionFor(providerId),
    baseUrl: els.baseUrl.value,
    apiKey: els.apiKey.value,
    status,
    message,
    testedAt: new Date().toISOString(),
  }
  renderConnectionStatus()
  scheduleWorkspaceSave()
}

function renderConnectionStatus() {
  const provider = currentProvider()
  const connection = connectionFor()
  const label = { idle: 'Not tested', busy: 'Checking', ok: 'Connected', err: 'Failed' }[connection.status] || 'Not tested'
  els.providerStatus.textContent = label
  els.providerStatus.className = `connection-pill ${connection.status || 'idle'}`
  els.providerCurrentLabel.textContent = provider.label
  els.connectionDetail.textContent = connection.message || 'Connection has not been tested.'
  els.connectorTitle.textContent = `${provider.label} connection`
}

function classifyError(error, provider = currentProvider()) {
  const message = error?.message || String(error)
  if (provider.protocol === 'gemini' && /无可用渠道|distributor|分组 default/.test(message)) {
    return {
      title: 'Proxy route unavailable',
      message: 'This Base URL is a proxy without a Gemini image distributor. Use the official Gemini Base URL or configure the proxy channel.',
    }
  }
  if (/API key|permission|PERMISSION_DENIED|401|403/i.test(message)) {
    return { title: 'Authentication failed', message }
  }
  return { title: 'Request failed', message }
}

function clearFieldErrors() {
  document.querySelectorAll('.field.invalid, .file-zone.invalid, .card.invalid').forEach((el) => el.classList.remove('invalid'))
  document.querySelectorAll('.field-error').forEach((el) => el.remove())
}

function fieldFor(id) {
  const element = document.querySelector(`#${id}`)
  return element?.closest('.field') || element?.closest('.card') || element
}

function markField(id, message) {
  const field = fieldFor(id)
  if (!field) return
  field.classList.add('invalid')
  const note = document.createElement('div')
  note.className = 'field-error'
  note.textContent = message
  field.append(note)
}

function revealField(id) {
  if (id === 'apiKey' || id === 'baseUrl') {
    const connector = document.querySelector('#connectorCard')
    if (connector?.classList.contains('collapsed')) document.querySelector('#toggleConnectorBtn').click()
  }
  const element = document.querySelector(`#${id}`)
  window.setTimeout(() => {
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    element?.focus?.({ preventScroll: true })
  }, 80)
}

function activeModel() {
  return els.model.value === 'custom' ? els.customModel.value.trim() : els.model.value
}

function effectiveSize() {
  if (els.size.value !== 'custom') return els.size.value
  return `${Number(els.customWidth.value) || 1024}x${Number(els.customHeight.value) || 1024}`
}

function parseExtraJson() {
  const raw = els.extraJson.value.trim()
  if (!raw) return { extra: {}, error: '' }
  try {
    const extra = JSON.parse(raw)
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return { extra: {}, error: 'Extra JSON must be an object.' }
    return { extra, error: '' }
  } catch {
    return { extra: {}, error: 'Extra JSON is invalid.' }
  }
}

function stateForProvider() {
  const { extra } = parseExtraJson()
  return {
    mode: state.mode,
    providerId: els.provider.value,
    model: activeModel(),
    prompt: els.prompt.value.trim(),
    size: effectiveSize(),
    quality: els.quality.value,
    count: Math.max(1, Number(els.count.value) || 1),
    outputFormat: els.outputFormat.value,
    outputCompression: els.outputCompression.value,
    background: els.background.value,
    inputFidelity: els.inputFidelity.value,
    files: state.mode === 'generate' ? [] : state.files,
    extra,
  }
}

function currentProvider() {
  return providerById(els.provider.value)
}

function baseUrl() {
  saveCurrentConnection()
  return els.baseUrl.value.trim().replace(/\/+$/, '')
}

function requestData() {
  const provider = currentProvider()
  const providerState = stateForProvider()
  const payload = provider.payload(providerState)
  const files = state.mode === 'mask' && state.files[0] ? [state.files[0]] : state.files
  const isGemini = provider.protocol === 'gemini'
  return {
    provider: provider.id,
    method: 'POST',
    url: `${baseUrl()}${provider.endpoint(providerState)}`,
    contentType: isGemini || state.mode === 'generate' ? 'application/json' : 'multipart/form-data',
    payload,
    files: state.mode === 'generate' ? [] : files.map((file, index) => ({
      field: isGemini ? 'inline_data' : 'image',
      index,
      name: file.name,
      width: file.width,
      height: file.height,
      bytes: file.bytes,
    })),
    mask: state.mode === 'mask' && !isGemini ? maskSummary() : null,
    validation: validate(false),
  }
}

function compactResponse(value) {
  if (Array.isArray(value)) return value.map(compactResponse)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if ((key === 'b64_json' || key === 'data') && typeof item === 'string' && item.length > 1000) {
      out[key] = `[base64 image omitted: ${item.length.toLocaleString()} chars]`
    } else {
      out[key] = compactResponse(item)
    }
  }
  return out
}

function setResponseBody(body, options = {}) {
  const copyFull = options.copyFull !== false
  const compact = compactResponse(body)
  els.responsePreview.textContent = JSON.stringify(compact, null, 2)
  state.rawResponseText = JSON.stringify(copyFull ? body : compact, null, 2)
}

function setResponseHeaders(headers = {}) {
  const compact = headers && Object.keys(headers).length ? headers : {}
  els.headersPreview.textContent = JSON.stringify(compact, null, 2)
  state.rawHeadersText = JSON.stringify(compact, null, 2)
}

function maskSummary() {
  const source = state.files[0]
  if (!source) return { required: true, status: 'missing source image' }
  return {
    required: true,
    sourceSize: `${source.width}x${source.height}`,
    apiMaskSize: `${source.width}x${source.height}`,
    uploadedMask: state.maskFile?.name || null,
    generatedFromCanvas: !state.maskFile,
    transparentPixelsAreEditRegion: true,
  }
}

function warnings() {
  const items = []
  const provider = currentProvider()
  if (provider.protocol === 'gemini' && state.mode === 'mask') items.push('Gemini native image editing uses semantic masking in the prompt; alpha-mask upload is not supported here.')
  if (provider.protocol !== 'gemini' && activeModel() === 'gpt-image-2' && els.background.value === 'transparent') items.push('gpt-image-2 does not support background=transparent.')
  if (provider.protocol !== 'gemini' && els.background.value === 'transparent' && els.outputFormat.value === 'jpeg') items.push('transparent background requires png or webp.')
  if (state.mode !== 'generate' && !state.files.length) items.push('Edit and Mask require at least one source image.')
  if (state.mode === 'mask' && state.files.length && !state.maskReady && !state.maskFile) items.push('Generate a mask canvas or import a mask before sending.')
  if (state.mode === 'mask' && state.files.length > 1) items.push('Mask mode sends only the first source image so the mask dimensions match exactly.')
  return items
}

function validate(show = true) {
  if (show) clearFieldErrors()
  const errors = []
  const addError = (field, message) => errors.push({ field, message })
  if (!activeModel()) addError('model', 'Model is empty.')
  if (!els.prompt.value.trim()) addError('prompt', 'Prompt is empty.')
  const extraJson = parseExtraJson()
  if (extraJson.error) addError('extraJson', extraJson.error)
  const provider = currentProvider()
  if (!provider.supportsSend) addError('provider', 'This provider adapter is preview-only in this build.')
  if (provider.protocol === 'gemini' && state.mode === 'mask') addError('maskCanvas', 'Gemini native does not accept alpha mask files. Use Edit with a semantic prompt.')
  if (provider.protocol !== 'gemini' && activeModel() === 'gpt-image-2' && els.background.value === 'transparent') addError('background', 'gpt-image-2 does not support background=transparent.')
  if (provider.protocol !== 'gemini' && els.background.value === 'transparent' && els.outputFormat.value === 'jpeg') addError('outputFormat', 'transparent background requires png or webp.')
  if (!baseUrl()) addError('baseUrl', 'Base URL is empty.')
  if (!els.apiKey.value.trim()) addError('apiKey', 'API key is empty.')
  if (state.mode !== 'generate' && !state.files.length) addError('sourceInput', 'No source images selected.')
  if (state.mode === 'mask' && state.files.length && !state.maskReady && !state.maskFile) addError('maskCanvas', 'Mask mode requires a generated or imported mask.')
  const result = { ok: errors.length === 0, errors, warnings: warnings() }
  if (show) {
    if (errors.length) {
      errors.forEach((error) => markField(error.field, error.message))
      setStatus(errors[0].message, 'err')
      showToast('Request needs attention', errors[0].message, 'err')
      revealField(errors[0].field)
    } else if (result.warnings.length) {
      setStatus(result.warnings[0], 'ok')
    }
    else setStatus('Validation passed', 'ok')
  }
  return result
}

function setSelectOptions(select, options, fallback) {
  const current = select.value
  select.innerHTML = options.map((option) => {
    const value = optionValue(option)
    const label = optionLabel(option)
    return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
  }).join('')
  if (options.some((option) => optionValue(option) === current)) select.value = current
  else select.value = fallback || optionValue(options[0]) || ''
  rebuildCustomSelect(select)
}

function optionValue(option) {
  return typeof option === 'string' ? option : option?.value || ''
}

function optionLabel(option) {
  return typeof option === 'string' ? option : option?.label || option?.value || ''
}

function applyProviderSchema() {
  const provider = currentProvider()
  if (els.provider.dataset.appliedProvider === provider.id) return
  els.provider.dataset.appliedProvider = provider.id
  if (provider.protocol === 'gemini') {
    setSelectOptions(els.model, provider.modelOptions, provider.defaultModel || 'gemini-3.1-flash-image')
    setSelectOptions(els.size, provider.sizeOptions, '1:1')
    setSelectOptions(els.quality, provider.qualityOptions, '1K')
  } else {
    setSelectOptions(els.model, provider.modelOptions || ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'custom'], provider.defaultModel || 'gpt-image-2')
    setSelectOptions(els.size, ['1024x1024', '1536x1024', '1024x1536', 'auto', 'custom'], '1024x1024')
    setSelectOptions(els.quality, ['low', 'medium', 'high', 'auto'], 'medium')
  }
}

function render() {
  applyProviderSchema()
  const provider = currentProvider()
  if (provider.supportsMask === false && state.mode === 'mask') applyMode('edit')
  renderConnectionStatus()
  document.querySelector('.segment')?.classList.toggle('two-mode', provider.supportsMask === false)
  document.querySelector('[data-mode="mask"]')?.classList.toggle('hidden', provider.supportsMask === false)
  document.querySelectorAll('.provider-choice').forEach((button) => {
    const active = button.dataset.provider === provider.id
    button.classList.toggle('active', active)
    button.dataset.status = connectionFor(button.dataset.provider).status || 'idle'
  })
  els.customModelWrap.classList.toggle('hidden', els.model.value !== 'custom')
  els.customSizeWrap.classList.toggle('hidden', provider.protocol === 'gemini' || els.size.value !== 'custom')
  els.formatCountRow.classList.toggle('hidden', provider.protocol === 'gemini')
  els.backgroundCompressionRow.classList.toggle('hidden', provider.protocol === 'gemini')
  els.inputFidelityRow.classList.toggle('hidden', provider.protocol === 'gemini')
  els.sizeLabel.textContent = provider.protocol === 'gemini' ? 'Aspect ratio' : 'Size'
  els.qualityLabel.textContent = provider.protocol === 'gemini' ? 'Image size' : 'Quality'
  els.maskCard.classList.toggle('show', state.mode === 'mask' && provider.supportsMask !== false)
  els.maskCard.classList.toggle('ready', state.maskReady || !!state.maskFile)
  els.makeMaskBtn.disabled = !state.files[0]
  els.endpointHint.textContent = `POST ${provider.endpoint(stateForProvider())}`
  els.sourceHint.textContent = state.mode === 'generate' ? 'Optional for generate' : provider.protocol === 'gemini' ? 'Gemini image inputs become inline_data parts' : state.mode === 'mask' ? 'Upload source, generate mask, then paint' : 'Required for edit'
  const warningItems = warnings()
  els.warnings.classList.toggle('show', warningItems.length > 0)
  els.warnings.innerHTML = warningItems.map((item) => `<div>${escapeHtml(item)}</div>`).join('')
  els.requestPreview.textContent = JSON.stringify(requestData(), null, 2)
  els.curlPreview.textContent = buildCurl()
  els.estimate.textContent = `$${estimateCost().toFixed(3)} est.`
  updateMaskMetrics()
  syncAllCustomSelects()
}

function switchProvider(providerId) {
  if (providerId === els.provider.value) return
  saveCurrentConnection()
  els.provider.value = providerId
  els.provider.dataset.appliedProvider = ''
  applyConnection(providerId)
  closeProviderMenu()
  const provider = currentProvider()
  state.mode = provider.supportsMask === false && state.mode === 'mask' ? 'edit' : state.mode
  applyMode(state.mode)
  render()
  scheduleWorkspaceSave()
}

function toggleProviderMenu() {
  els.providerMenu.classList.toggle('hidden')
  els.providerMenuBtn.classList.toggle('active', !els.providerMenu.classList.contains('hidden'))
}

function closeProviderMenu() {
  els.providerMenu.classList.add('hidden')
  els.providerMenuBtn.classList.remove('active')
}

function buildCurl() {
  const req = requestData()
  if (currentProvider().protocol === 'gemini') {
    return `curl ${quote(req.url)} \\\n  -H ${quote('x-goog-api-key: $API_KEY')} \\\n  -H ${quote('Content-Type: application/json')} \\\n  -d ${quote(JSON.stringify(req.payload, null, 2))}`
  }
  if (state.mode === 'generate') {
    return `curl ${quote(req.url)} \\\n  -H ${quote('Authorization: Bearer $API_KEY')} \\\n  -H ${quote('Content-Type: application/json')} \\\n  -d ${quote(JSON.stringify(req.payload, null, 2))}`
  }
  const lines = [`curl ${quote(req.url)} \\`, `  -H ${quote('Authorization: Bearer $API_KEY')} \\`]
  Object.entries(req.payload).forEach(([key, value]) => lines.push(`  -F ${quote(`${key}=${value}`)} \\`))
  req.files.forEach((file) => lines.push(`  -F ${quote(`image=@${file.name}`)} \\`))
  if (state.mode === 'mask') lines.push(`  -F ${quote('mask=@api-mask.png')} \\`)
  return lines.join('\n').replace(/ \\\\$/, '')
}

function quote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

function estimateCost() {
  const providerEstimate = currentProvider().estimateCost?.(stateForProvider())
  if (providerEstimate != null) return providerEstimate
  const quality = els.quality.value === 'auto' ? 'medium' : els.quality.value
  const size = els.size.value === 'auto' || els.size.value === 'custom' ? '1024x1024' : els.size.value
  const table = {
    '1024x1024': { low: .006, medium: .053, high: .211 },
    '1536x1024': { low: .005, medium: .041, high: .165 },
    '1024x1536': { low: .005, medium: .041, high: .165 },
  }
  return (table[size]?.[quality] || 0) * (Number(els.count.value) || 1)
}

const priceTable = {
  'gpt-image-2': {
    imageInput: 8, imageCachedInput: 2, imageOutput: 30,
    textInput: 5, textCachedInput: 1.25, textOutput: 0,
  },
  'gpt-image-1.5': {
    imageInput: 8, imageCachedInput: 2, imageOutput: 32,
    textInput: 5, textCachedInput: 1.25, textOutput: 10,
  },
  'gpt-image-1-mini': {
    imageInput: 2.5, imageCachedInput: .25, imageOutput: 8,
    textInput: 2, textCachedInput: .2, textOutput: 0,
  },
}

function usageCost(body, model) {
  const providerCost = currentProvider().usageCost?.(body, model)
  if (providerCost) return providerCost
  const usage = body?.usage
  const prices = priceTable[model]
  if (!usage || !prices) return { label: 'usage not returned', value: null, usage: null }
  const inputDetails = usage.input_tokens_details || usage.input_details || {}
  const outputDetails = usage.output_tokens_details || usage.output_details || {}
  const imageInput = Number(inputDetails.image_tokens || usage.image_input_tokens || 0)
  const imageCached = Number(inputDetails.cached_image_tokens || inputDetails.cached_tokens || 0)
  const imageOutput = Number(outputDetails.image_tokens || usage.image_output_tokens || usage.output_image_tokens || 0)
  const textInput = Number(inputDetails.text_tokens || usage.input_text_tokens || usage.prompt_tokens || usage.input_tokens || 0)
  const textCached = Number(inputDetails.cached_text_tokens || 0)
  const textOutput = Number(outputDetails.text_tokens || usage.output_text_tokens || usage.completion_tokens || 0)
  const cost = (
    Math.max(0, imageInput - imageCached) * prices.imageInput +
    imageCached * prices.imageCachedInput +
    imageOutput * prices.imageOutput +
    Math.max(0, textInput - textCached) * prices.textInput +
    textCached * prices.textCachedInput +
    textOutput * prices.textOutput
  ) / 1_000_000
  return {
    label: `$${cost.toFixed(6)}`,
    value: cost,
    usage: { imageInput, imageCached, imageOutput, textInput, textCached, textOutput },
  }
}

function setCost(cost) {
  els.estimate.textContent = cost?.value == null ? 'usage not returned' : cost.label
}

async function captureWorkspaceSnapshot() {
  const sourceImages = await Promise.all(state.files.map(async (item) => ({
    name: item.name,
    type: item.file?.type || 'image/png',
    width: item.width,
    height: item.height,
    bytes: item.bytes,
    dataUrl: await fileDataUrl(item.file),
  })))
  let maskOverlay = null
  if (state.maskReady && els.maskCanvas.width && els.maskCanvas.height) {
    maskOverlay = els.maskCanvas.toDataURL('image/png')
  }
  let importedMask = null
  if (state.maskFile) {
    importedMask = { name: state.maskFile.name || 'mask.png', dataUrl: await fileDataUrl(state.maskFile) }
  }
  return {
    state: stateForProvider(),
    mode: state.mode,
    brushSize: els.brushSize.value,
    sourceImages,
    maskReady: state.maskReady,
    maskOverlay,
    importedMask,
  }
}

async function restoreWorkspaceSnapshot(snapshot) {
  if (!snapshot) return false
  const providerState = snapshot.state || {}
  state.mode = snapshot.mode || providerState.mode || state.mode
  document.querySelectorAll('.mode').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode))
  const assignments = {
    provider: providerState.providerId,
    model: providerState.model,
    prompt: providerState.prompt,
    size: providerState.size,
    quality: providerState.quality,
    count: providerState.count,
    outputFormat: providerState.outputFormat,
    outputCompression: providerState.outputCompression,
    background: providerState.background,
    inputFidelity: providerState.inputFidelity,
  }
  for (const [id, value] of Object.entries(assignments)) {
    const el = document.querySelector(`#${id}`)
    if (!el || value == null) continue
    if (el.tagName === 'SELECT' && !Array.from(el.options).some((option) => option.value === String(value))) {
      el.value = 'custom'
      if (id === 'model') els.customModel.value = value
    } else {
      el.value = value
    }
  }
  els.extraJson.value = providerState.extra && Object.keys(providerState.extra).length ? JSON.stringify(providerState.extra, null, 2) : els.extraJson.value
  state.files.forEach((item) => item.url?.startsWith('blob:') && URL.revokeObjectURL(item.url))
  const restoredFiles = await Promise.all((snapshot.sourceImages || []).map(async (item) => {
    try {
      const file = await dataUrlFile(item.dataUrl, item.name)
      return imageMeta(file, item.dataUrl)
    } catch {
      return null
    }
  }))
  state.files = restoredFiles.filter(Boolean)
  state.maskFile = snapshot.importedMask ? await dataUrlFile(snapshot.importedMask.dataUrl, snapshot.importedMask.name) : null
  state.maskReady = false
  renderFiles()
  render()
  if (snapshot.maskOverlay && state.files[0]) {
    await generateMaskCanvas({ silent: true, overlay: snapshot.maskOverlay })
  } else if (state.mode === 'mask' && state.files[0]) {
    await generateMaskCanvas({ silent: true })
  }
  els.brushSize.value = snapshot.brushSize || els.brushSize.value
  els.brushNumber.value = els.brushSize.value
  render()
  return true
}

async function loadSourceFiles(files) {
  const zone = document.querySelector('#sourceInput')?.closest('.file-zone')
  zone?.classList.add('is-loading')
  state.files.forEach((item) => URL.revokeObjectURL(item.url))
  const selected = Array.from(files || []).filter((file) => file.type.startsWith('image/'))
  state.files = await Promise.all(selected.map((file) => {
    const url = URL.createObjectURL(file)
    return imageMeta(file, url)
  }))
  zone?.classList.remove('is-loading')
  state.maskReady = false
  renderFiles()
  render()
  if (state.mode === 'mask' && state.files[0]) await generateMaskCanvas({ silent: true })
}

function renderFiles() {
  els.fileList.innerHTML = ''
  state.files.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'file-item'
    row.innerHTML = `<img src="${item.url}" alt=""><div><strong>${escapeHtml(item.name)}</strong><span>${item.width}x${item.height} · ${Math.round(item.bytes / 1024)} KB${index === 0 ? ' · mask source' : ''}</span></div><button class="btn">Remove</button>`
    row.querySelector('button').addEventListener('click', () => {
      URL.revokeObjectURL(item.url)
      state.files.splice(index, 1)
      state.maskReady = false
      renderFiles()
      render()
    })
    els.fileList.append(row)
  })
}

function generateMaskCanvas(options = {}) {
  const source = state.files[0]
  if (!source) {
    setStatus('Upload a source image first', 'err')
    return
  }
  if (!options.silent) setButtonBusy(els.makeMaskBtn, true, 'Preparing')
  return new Promise((resolve) => {
    els.maskImage.onload = async () => {
    els.maskCanvas.width = source.width
    els.maskCanvas.height = source.height
    clearMask()
    if (options.overlay) {
      const overlay = new Image()
      await new Promise((done) => {
      overlay.onload = () => {
        els.maskCanvas.getContext('2d').drawImage(overlay, 0, 0, source.width, source.height)
        updateMaskMetrics()
        done()
      }
      overlay.onerror = done
      overlay.src = options.overlay
      })
    }
    state.maskReady = true
    if (!options.silent) {
      setStatus(`Mask canvas ${source.width}x${source.height} ready`, 'ok')
      setButtonBusy(els.makeMaskBtn, false)
      flashButton(els.makeMaskBtn)
    }
    render()
    requestAnimationFrame(syncCanvasSize)
    resolve()
  }
  els.maskImage.onerror = () => {
    if (!options.silent) setButtonBusy(els.makeMaskBtn, false)
    setStatus('Could not load source image for mask canvas', 'err')
    resolve()
  }
  els.maskImage.src = source.url
  })
}

function syncCanvasSize() {
  if (!els.maskImage.naturalWidth) return
  const width = els.maskImage.clientWidth || els.maskImage.naturalWidth
  const height = els.maskImage.clientHeight || els.maskImage.naturalHeight
  els.maskCanvas.style.width = `${width}px`
  els.maskCanvas.style.height = `${height}px`
}

function pointFromEvent(event) {
  const rect = els.maskCanvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (els.maskCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (els.maskCanvas.height / rect.height),
  }
}

function paintMask(event) {
  if (!state.maskReady) return
  const point = pointFromEvent(event)
  const ctx = els.maskCanvas.getContext('2d')
  ctx.globalCompositeOperation = state.maskTool === 'erase' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = 'rgba(201,100,66,.55)'
  ctx.fillStyle = 'rgba(201,100,66,.55)'
  ctx.lineWidth = Number(els.brushSize.value)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (state.lastPoint) {
    ctx.moveTo(state.lastPoint.x, state.lastPoint.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  } else {
    ctx.arc(point.x, point.y, Number(els.brushSize.value) / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
  state.lastPoint = point
  updateMaskMetrics()
}

function clearMask() {
  els.maskCanvas.getContext('2d').clearRect(0, 0, els.maskCanvas.width, els.maskCanvas.height)
  updateMaskMetrics()
}

function fillMask() {
  if (!state.maskReady) return
  const ctx = els.maskCanvas.getContext('2d')
  ctx.fillStyle = 'rgba(201,100,66,.5)'
  ctx.fillRect(0, 0, els.maskCanvas.width, els.maskCanvas.height)
  updateMaskMetrics()
}

function updateMaskMetrics() {
  const source = state.files[0]
  document.querySelector('#sourceMetric').textContent = source ? `${source.width}x${source.height}` : '-'
  if (!state.maskReady) {
    document.querySelector('#maskMetric').textContent = '-'
    document.querySelector('#apiMaskMetric').textContent = source ? `${source.width}x${source.height} target` : '-'
    return
  }
  const data = els.maskCanvas.getContext('2d').getImageData(0, 0, els.maskCanvas.width, els.maskCanvas.height).data
  let painted = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++
  document.querySelector('#maskMetric').textContent = `${els.maskCanvas.width}x${els.maskCanvas.height} · ${painted} px`
  document.querySelector('#apiMaskMetric').textContent = `${els.maskCanvas.width}x${els.maskCanvas.height} PNG`
}

async function apiMaskBlob() {
  const source = state.files[0]
  if (!source) throw new Error('No source image.')
  if (state.maskFile) return resizeMaskFile(state.maskFile, source.width, source.height)
  return alphaMaskFromPaintCanvas(els.maskCanvas, source.width, source.height)
}

async function requestAssetsForSend() {
  if (state.mode !== 'mask') return { files: state.files, maskBlob: null }
  const source = state.files[0]
  if (!source) throw new Error('No source image.')
  const normalizedFile = await normalizeImageFile(source.file, source.width, source.height, 'source-normalized.png')
  const normalizedSource = { ...source, file: normalizedFile, name: 'source-normalized.png', bytes: normalizedFile.size }
  const maskBlob = await apiMaskBlob()
  const maskSize = await blobImageSize(maskBlob)
  const imageSize = await blobImageSize(normalizedFile)
  if (maskSize.width !== imageSize.width || maskSize.height !== imageSize.height) {
    throw new Error(`Mask size ${maskSize.width}x${maskSize.height} does not match normalized image size ${imageSize.width}x${imageSize.height}.`)
  }
  return { files: [normalizedSource], maskBlob }
}

async function sendRequest() {
  const check = validate(true)
  const sendBtn = document.querySelector('#sendBtn')
  if (!check.ok) {
    flashButton(sendBtn, 'warn')
    sendBtn.classList.add('shake')
    window.setTimeout(() => sendBtn.classList.remove('shake'), 460)
    return
  }
  const provider = currentProvider()
  if (!provider.supportsSend) {
    setStatus('This provider adapter is preview-only in this build', 'err')
    showToast('Cannot send', 'This provider adapter is preview-only in this build.', 'err')
    return
  }

  const request = requestData()
  const started = performance.now()
  const abortBtn = document.querySelector('#abortBtn')
  state.controller = new AbortController()
  setButtonBusy(sendBtn, true, 'Sending')
  abortBtn.disabled = false
  setStatus('Sending request...', 'busy')
  try {
    const assets = await requestAssetsForSend()
    const response = await provider.send({
      baseUrl: baseUrl(),
      apiKey: document.querySelector('#apiKey').value.trim(),
      state: stateForProvider(),
      payload: request.payload,
      files: assets.files,
      maskBlob: assets.maskBlob,
      signal: state.controller.signal,
    })
    const latency = Math.round(performance.now() - started)
    const images = responseImages(response.body, els.outputFormat.value)
    const cost = usageCost(response.body, activeModel())
    setResponseBody(response.body)
    setResponseHeaders(response.headers)
    setCost(cost)
    renderProofs(images)
    const thumbnails = await imageThumbnails(images)
    const snapshot = await captureWorkspaceSnapshot()
    const run = await saveRun({ ok: true, status: response.status, latency, request, response: compactResponse(response.body), headers: response.headers || {}, images, thumbnails, cost, snapshot })
    state.runs = [run, ...state.runs].slice(0, 40)
    renderHistory()
    setStatus(`OK ${response.status} · ${(latency / 1000).toFixed(1)}s`, 'ok')
    setConnectionStatus('ok', `Connected · last request OK ${response.status} · ${(latency / 1000).toFixed(1)}s`)
    switchTab('response')
  } catch (error) {
    const latency = Math.round(performance.now() - started)
    const body = error.body || { error: { message: error.message || String(error) } }
    const cost = usageCost(body, activeModel())
    setResponseBody(body)
    setResponseHeaders(error.headers || {})
    setCost(cost)
    const snapshot = await captureWorkspaceSnapshot()
    const run = await saveRun({ ok: false, status: error.status || 0, latency, request, response: compactResponse(body), headers: error.headers || {}, images: [], thumbnails: [], cost, snapshot })
    state.runs = [run, ...state.runs].slice(0, 40)
    renderHistory()
    const classified = classifyError(error, provider)
    setStatus(classified.message, 'err')
    setConnectionStatus('err', classified.message)
    showToast(classified.title, classified.message, 'err')
    switchTab('response')
  } finally {
    state.controller = null
    setButtonBusy(sendBtn, false)
    abortBtn.disabled = true
  }
}

function renderProofs(images) {
  if (!images.length) {
    els.resultStage.className = 'result-stage empty'
    els.resultStage.innerHTML = '<div>No image yet</div>'
    els.proofs.innerHTML = ''
    return
  }
  els.resultStage.className = `result-stage count-${Math.min(images.length, 4)}`
  els.resultStage.innerHTML = images.map((url, index) => `
    <button class="result-image" data-preview-index="${index}" title="Open large preview">
      <img src="${url}" alt="result ${index + 1}">
      <span>${icons.zoom}</span>
    </button>
  `).join('')
  els.proofs.innerHTML = images.map((url, index) => `
    <button class="proof ${index === 0 ? 'active' : ''}" data-preview-index="${index}" title="Open result ${index + 1}">
      <img src="${url}" alt="result thumbnail ${index + 1}">
      <span>#${index + 1}</span>
    </button>
  `).join('')
}

function renderHistory() {
  els.historyList.innerHTML = state.runs.map((run) => {
    const thumbUrl = run.thumbnails?.[0] || run.images?.[0] || ''
    const thumb = thumbUrl ? `<img loading="lazy" src="${thumbUrl}" alt="history result">` : `<span class="history-placeholder">${run.ok ? 'OK' : 'ERR'}</span>`
    const more = run.images?.length > 1 ? `<em>+${run.images.length - 1}</em>` : ''
    return `<button class="history-item ${run.ok ? 'ok' : 'err'}" data-id="${run.id}">
      <span class="history-thumb">${thumb}${more}</span>
      <span class="history-copy">
        <strong>${run.ok ? 'OK' : 'ERR'} ${run.status} · ${escapeHtml(run.request.payload.model || run.request.provider)}</strong>
        <span>${new Date(run.createdAt).toLocaleString()} · ${(run.latency / 1000).toFixed(1)}s · ${escapeHtml(run.cost?.label || 'usage not returned')}</span>
        <span>${escapeHtml(run.request.payload.prompt || run.request.payload.contents?.[0]?.parts?.[0]?.text || '').slice(0, 140)}</span>
      </span>
    </button>`
  }).join('')
  els.historyList.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => restoreRun(Number(button.dataset.id))))
}

async function restoreRun(id) {
  const run = state.runs.find((item) => item.id === id)
  if (!run) return
  setResponseBody(run.response, { copyFull: false })
  setResponseHeaders(run.headers || {})
  renderProofs(run.images || [])
  switchTab('response')
  await restoreWorkspaceSnapshot(run.snapshot).catch(() => false)
  setCost(run.cost || null)
  setStatus('History restored', 'ok')
}

function openLightbox(images, index = 0) {
  if (!images.length) return
  const url = images[index] || images[0]
  els.lightbox.dataset.zoom = 'fit'
  els.lightbox.dataset.index = String(index)
  els.lightboxImage.src = url
  els.lightboxImage.style.width = ''
  els.lightboxImage.style.maxWidth = ''
  els.lightboxImage.style.maxHeight = ''
  els.lightboxImage.className = 'fit'
  els.lightboxMeta.textContent = `Image ${index + 1} of ${images.length}`
  els.lightbox.classList.remove('hidden')
  document.body.classList.add('modal-open')
}

function closeLightbox() {
  els.lightbox.classList.add('hidden')
  els.lightboxImage.removeAttribute('src')
  document.body.classList.remove('modal-open')
}

function setLightboxZoom(mode) {
  const current = Number(els.lightbox.dataset.scale || '1')
  let scale = current
  if (mode === 'fit') {
    els.lightbox.dataset.zoom = 'fit'
    els.lightbox.dataset.scale = '1'
    els.lightboxImage.className = 'fit'
    els.lightboxImage.style.width = ''
    return
  }
  if (mode === 'actual') scale = 1
  if (mode === 'in') scale = Math.min(4, current + .25)
  if (mode === 'out') scale = Math.max(.25, current - .25)
  els.lightbox.dataset.zoom = 'scale'
  els.lightbox.dataset.scale = String(scale)
  els.lightboxImage.className = 'scaled'
  const naturalWidth = els.lightboxImage.naturalWidth || 1200
  els.lightboxImage.style.width = `${Math.round(naturalWidth * scale)}px`
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab))
  for (const name of ['request', 'response', 'history', 'curl']) document.querySelector(`#${name}Tab`).classList.toggle('hidden', name !== tab)
}

function workspaceConfig() {
  return {
    baseUrl: els.baseUrl.value,
    apiKey: els.apiKey.value,
    provider: els.provider.value,
    model: els.model.value,
    customModel: els.customModel.value,
    size: els.size.value,
    customWidth: els.customWidth.value,
    customHeight: els.customHeight.value,
    quality: els.quality.value,
    outputFormat: els.outputFormat.value,
    count: els.count.value,
    background: els.background.value,
    outputCompression: els.outputCompression.value,
    inputFidelity: els.inputFidelity.value,
    prompt: els.prompt.value,
    extraJson: els.extraJson.value,
    mode: state.mode,
    brushSize: els.brushSize.value,
    connectorCollapsed: document.querySelector('#connectorCard').classList.contains('collapsed'),
    connections: state.connections,
  }
}

function persistWorkspace({ notify = false } = {}) {
  saveConfig(workspaceConfig())
  if (!notify) return
  setStatus('Workspace saved', 'ok')
  flashButton(document.querySelector('#saveWorkspaceBtn'))
}

function saveWorkspace() {
  persistWorkspace({ notify: true })
}

function scheduleWorkspaceSave() {
  if (state.hydratingWorkspace) return
  clearTimeout(state.workspaceSaveTimer)
  state.workspaceSaveTimer = window.setTimeout(() => persistWorkspace(), 180)
}

function applyMode(mode) {
  if (!['generate', 'edit', 'mask'].includes(mode)) return
  state.mode = mode
  document.querySelectorAll('.mode').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode))
}

function updateConnectorToggle() {
  const card = document.querySelector('#connectorCard')
  const expanded = !card.classList.contains('collapsed')
  const button = document.querySelector('#toggleConnectorBtn')
  button.innerHTML = expanded ? icons.chevronUp : icons.chevronDown
  button.title = expanded ? 'Collapse connector' : 'Expand connector'
  button.setAttribute('aria-label', button.title)
}

function loadWorkspace() {
  const config = loadConfig()
  state.hydratingWorkspace = true
  state.connections = config.connections || {
    'openai-images': {
      baseUrl: config.baseUrl || providerById('openai-images').defaultBaseUrl || '',
      apiKey: config.apiKey || '',
      status: 'idle',
      message: 'Connection has not been tested.',
    },
  }
  for (const [key, value] of Object.entries(config)) {
    if (key === 'connections') continue
    const element = document.querySelector(`#${key}`)
    if (element && value !== undefined && value !== null) element.value = value
  }
  applyConnection(els.provider.value)
  applyMode(config.mode || state.mode)
  if (config.brushSize) {
    els.brushSize.value = config.brushSize
    els.brushNumber.value = config.brushSize
  }
  const connector = document.querySelector('#connectorCard')
  connector.classList.toggle('collapsed', config.connectorCollapsed !== false)
  updateConnectorToggle()
  state.hydratingWorkspace = false
}

async function loadImageModels() {
  const buttons = [document.querySelector('#testModelsBtn'), document.querySelector('#loadModelsBtn')].filter(Boolean)
  buttons.forEach((button) => setButtonBusy(button, true, 'Loading'))
  try {
    const provider = currentProvider()
    const modelsPath = provider.protocol === 'gemini' ? '/v1beta/models' : '/v1/models'
    setConnectionStatus('busy', `Checking ${modelsPath}...`)
    setStatus(`Loading ${modelsPath}...`, 'busy')
    const headers = provider.protocol === 'gemini'
      ? { 'x-goog-api-key': document.querySelector('#apiKey').value.trim() }
      : { Authorization: `Bearer ${document.querySelector('#apiKey').value.trim()}` }
    const response = await fetch(`${baseUrl()}${modelsPath}`, { headers })
    const body = await response.json()
    if (!response.ok) throw new Error(body?.error?.message || `HTTP ${response.status}`)
    const current = activeModel()
    const modelItems = provider.protocol === 'gemini'
      ? (body.models || []).map((model) => ({ id: String(model.name || '').replace(/^models\//, ''), raw: model }))
      : (body.data || []).map((model) => ({ id: model.id, raw: model }))
    const ids = Array.from(new Set(modelItems.filter((model) => {
      const text = JSON.stringify(model).toLowerCase()
      return model.id && (text.includes('image') || text.includes('图像') || text.includes('绘画') || text.includes('gemini') || text.includes('banana'))
    }).map((model) => model.id)))
    const defaults = provider.modelOptions?.filter((item) => optionValue(item) !== 'custom') || []
    const merged = [...defaults, ...ids].reduce((items, item) => {
      if (!items.some((existing) => optionValue(existing) === optionValue(item))) items.push(item)
      return items
    }, [])
    els.model.innerHTML = merged.map((item) => `<option value="${escapeHtml(optionValue(item))}">${escapeHtml(optionLabel(item))}</option>`).join('') + '<option value="custom">Custom...</option>'
    if ([...els.model.options].some((option) => option.value === current)) els.model.value = current
    rebuildCustomSelect(els.model)
    setStatus(`${modelsPath} OK · ${ids.length} image-like models`, 'ok')
    setConnectionStatus('ok', `${modelsPath} OK · ${ids.length} image-like models`)
    setResponseBody(body)
    setResponseHeaders(Object.fromEntries(response.headers.entries()))
    switchTab('response')
    render()
  } catch (error) {
    const classified = classifyError(error)
    setStatus(classified.message, 'err')
    setConnectionStatus('err', classified.message)
    showToast(classified.title, classified.message, 'err')
  } finally {
    buttons.forEach((button) => setButtonBusy(button, false))
  }
}

async function hydrateHistoryThumbnails() {
  let changed = false
  const updates = state.runs.slice(0, 12).map(async (run) => {
    if (run.thumbnails?.length || !run.images?.length) return run
    const thumbnails = await imageThumbnails(run.images)
    if (!thumbnails.some(Boolean)) return run
    changed = true
    const updated = { ...run, thumbnails }
    await saveRun(updated)
    return updated
  })
  const updated = await Promise.all(updates)
  updated.forEach((run, index) => {
    state.runs[index] = run
  })
  if (changed) renderHistory()
}

function enhanceSelects() {
  document.querySelectorAll('select').forEach((select) => {
    if (select.id === 'provider') return
    select.classList.add('native-select')
    const widget = document.createElement('div')
    widget.className = 'select-shell'
    widget.dataset.selectId = select.id
    widget.innerHTML = `
      <button class="select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span></span>${icons.chevronDown}
      </button>
      <div class="select-menu" role="listbox"></div>
    `
    select.insertAdjacentElement('afterend', widget)
    const trigger = widget.querySelector('.select-trigger')
    trigger.addEventListener('click', (event) => {
      event.stopPropagation()
      toggleCustomSelect(select)
    })
    trigger.addEventListener('keydown', (event) => handleSelectKeydown(event, select))
    state.customSelects.set(select, widget)
    rebuildCustomSelect(select)
  })
  document.addEventListener('click', closeCustomSelects)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCustomSelects()
  })
}

function rebuildCustomSelect(select) {
  const widget = state.customSelects.get(select)
  if (!widget) return
  const menu = widget.querySelector('.select-menu')
  menu.innerHTML = ''
  Array.from(select.options).forEach((option) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'select-option'
    item.setAttribute('role', 'option')
    item.dataset.value = option.value
    item.textContent = option.textContent
    item.addEventListener('click', (event) => {
      event.stopPropagation()
      chooseCustomOption(select, option.value)
    })
    menu.append(item)
  })
  syncCustomSelect(select)
}

function syncAllCustomSelects() {
  state.customSelects.forEach((_, select) => syncCustomSelect(select))
}

function syncCustomSelect(select) {
  const widget = state.customSelects.get(select)
  if (!widget) return
  const selected = select.selectedOptions[0] || select.options[0]
  widget.querySelector('.select-trigger span').textContent = selected?.textContent || ''
  widget.querySelectorAll('.select-option').forEach((option) => {
    const active = option.dataset.value === select.value
    option.classList.toggle('active', active)
    option.setAttribute('aria-selected', active ? 'true' : 'false')
  })
}

function chooseCustomOption(select, value) {
  if (select.value !== value) {
    select.value = value
    select.dispatchEvent(new Event('input', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }
  closeCustomSelects()
  syncCustomSelect(select)
}

function toggleCustomSelect(select) {
  const widget = state.customSelects.get(select)
  if (!widget) return
  const open = !widget.classList.contains('open')
  closeCustomSelects()
  widget.classList.toggle('open', open)
  widget.querySelector('.select-trigger').setAttribute('aria-expanded', open ? 'true' : 'false')
  if (open) {
    const active = widget.querySelector('.select-option.active')
    active?.scrollIntoView({ block: 'nearest' })
  }
}

function closeCustomSelects() {
  state.customSelects.forEach((widget) => {
    widget.classList.remove('open')
    widget.querySelector('.select-trigger').setAttribute('aria-expanded', 'false')
  })
}

function handleSelectKeydown(event, select) {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return
  event.preventDefault()
  const options = Array.from(select.options)
  const current = Math.max(0, options.findIndex((option) => option.value === select.value))
  if (event.key === 'Enter' || event.key === ' ') return toggleCustomSelect(select)
  const next = event.key === 'ArrowDown' ? Math.min(options.length - 1, current + 1) : Math.max(0, current - 1)
  chooseCustomOption(select, options[next].value)
}

function bind() {
  enhanceSelects()
  document.querySelectorAll('.mode').forEach((button) => button.addEventListener('click', () => {
    applyMode(button.dataset.mode)
    flashButton(button)
    render()
    scheduleWorkspaceSave()
    if (state.mode === 'mask' && state.files[0] && !state.maskReady) generateMaskCanvas({ silent: true })
  }))
  document.querySelectorAll('.provider-choice').forEach((button) => button.addEventListener('click', () => {
    switchProvider(button.dataset.provider)
    flashButton(button)
  }))
  els.providerMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    toggleProviderMenu()
  })
  document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => { switchTab(button.dataset.tab); flashButton(button) }))
  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async (event) => {
    event.stopPropagation()
    const text = button.dataset.copy === 'responsePreview'
      ? state.rawResponseText
      : button.dataset.copy === 'headersPreview'
        ? state.rawHeadersText
        : document.querySelector(`#${button.dataset.copy}`).textContent
    await navigator.clipboard.writeText(text)
    flashButton(button)
    setStatus('Copied', 'ok')
  }))
  els.toastClose.addEventListener('click', hideToast)
  document.querySelector('#toggleConnectorBtn').addEventListener('click', () => {
    const card = document.querySelector('#connectorCard')
    card.classList.toggle('collapsed')
    updateConnectorToggle()
    scheduleWorkspaceSave()
  })
  document.querySelector('#sourceInput').addEventListener('change', (event) => loadSourceFiles(event.target.files))
  document.querySelector('#maskInput').addEventListener('change', (event) => {
    state.maskFile = event.target.files?.[0] || null
    render()
  })
  document.querySelector('#makeMaskBtn').addEventListener('click', generateMaskCanvas)
  document.querySelector('#downloadMaskBtn').addEventListener('click', async () => {
    const button = document.querySelector('#downloadMaskBtn')
    setButtonBusy(button, true, 'Exporting')
    try {
      const blob = await apiMaskBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'api-mask.png'
      a.click()
      URL.revokeObjectURL(url)
      flashButton(button)
      setStatus('Mask downloaded', 'ok')
    } catch (error) {
      setStatus(error.message || String(error), 'err')
    } finally {
      setButtonBusy(button, false)
    }
  })
  document.querySelector('#paintBtn').addEventListener('click', (event) => { setMaskTool('paint'); flashButton(event.currentTarget) })
  document.querySelector('#eraseBtn').addEventListener('click', (event) => { setMaskTool('erase'); flashButton(event.currentTarget) })
  document.querySelector('#clearMaskBtn').addEventListener('click', (event) => { clearMask(); flashButton(event.currentTarget) })
  const setBrushSize = (value) => {
    const next = Math.max(6, Math.min(180, Number(value) || 48))
    els.brushSize.value = String(next)
    els.brushNumber.value = String(next)
    scheduleWorkspaceSave()
  }
  els.brushSize.addEventListener('input', () => setBrushSize(els.brushSize.value))
  els.brushNumber.addEventListener('input', () => setBrushSize(els.brushNumber.value))
  els.brushDownBtn.addEventListener('click', () => setBrushSize(Number(els.brushSize.value) - 6))
  els.brushUpBtn.addEventListener('click', () => setBrushSize(Number(els.brushSize.value) + 6))
  let drawing = false
  const stopDrawing = () => { drawing = false; state.lastPoint = null }
  els.maskCanvas.addEventListener('pointerdown', (event) => { drawing = true; state.lastPoint = null; els.maskCanvas.setPointerCapture(event.pointerId); paintMask(event) })
  els.maskCanvas.addEventListener('pointermove', (event) => { if (drawing) paintMask(event) })
  els.maskCanvas.addEventListener('pointerup', stopDrawing)
  els.maskCanvas.addEventListener('pointercancel', stopDrawing)
  els.maskCanvas.addEventListener('pointerleave', stopDrawing)
  window.addEventListener('resize', syncCanvasSize)
  document.querySelector('#validateBtn').addEventListener('click', (event) => { const result = validate(true); flashButton(event.currentTarget, result.ok ? 'done' : 'warn') })
  document.querySelector('#sendBtn').addEventListener('click', sendRequest)
  document.querySelector('#abortBtn').addEventListener('click', () => state.controller?.abort())
  document.querySelector('#testModelsBtn').addEventListener('click', loadImageModels)
  document.querySelector('#loadModelsBtn').addEventListener('click', loadImageModels)
  document.querySelector('#saveWorkspaceBtn').addEventListener('click', saveWorkspace)
  document.querySelector('#clearRunsBtn').addEventListener('click', async (event) => {
    const button = event.currentTarget
    setButtonBusy(button, true, 'Clearing')
    await clearRuns()
    state.runs = []
    renderHistory()
    renderProofs([])
    setButtonBusy(button, false)
    flashButton(button)
    setStatus('History cleared', 'ok')
  })
  els.resultStage.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preview-index]')
    if (!button) return
    const images = Array.from(els.resultStage.querySelectorAll('.result-image img')).map((img) => img.src)
    openLightbox(images, Number(button.dataset.previewIndex))
  })
  els.proofs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preview-index]')
    if (!button) return
    const images = Array.from(els.resultStage.querySelectorAll('.result-image img')).map((img) => img.src)
    openLightbox(images, Number(button.dataset.previewIndex))
  })
  document.querySelector('#closeLightboxBtn').addEventListener('click', closeLightbox)
  document.querySelector('#fitImageBtn').addEventListener('click', () => setLightboxZoom('fit'))
  document.querySelector('#actualImageBtn').addEventListener('click', () => setLightboxZoom('actual'))
  document.querySelector('#zoomInBtn').addEventListener('click', () => setLightboxZoom('in'))
  document.querySelector('#zoomOutBtn').addEventListener('click', () => setLightboxZoom('out'))
  els.lightbox.addEventListener('click', (event) => {
    if (event.target === els.lightbox || event.target === els.lightboxViewport) closeLightbox()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.lightbox.classList.contains('hidden')) closeLightbox()
    if (event.key === 'Escape') closeProviderMenu()
  })
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.provider-strip')) closeProviderMenu()
  })
  for (const element of document.querySelectorAll('input, select, textarea')) {
    element.addEventListener('input', () => {
      if (element === els.baseUrl || element === els.apiKey) saveCurrentConnection()
      render()
      scheduleWorkspaceSave()
    })
    element.addEventListener('change', () => {
      if (element === els.provider) switchProvider(element.value)
      if (element === els.baseUrl || element === els.apiKey) saveCurrentConnection()
      scheduleWorkspaceSave()
    })
  }
}

function setMaskTool(tool) {
  state.maskTool = tool
  els.paintBtn.classList.toggle('active', tool === 'paint')
  els.eraseBtn.classList.toggle('active', tool === 'erase')
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

loadWorkspace()
bind()
state.runs = await listRuns()
renderHistory()
hydrateHistoryThumbnails().catch(() => {})
if (state.runs[0]?.images?.length) renderProofs(state.runs[0].images)
render()
