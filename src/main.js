import './styles.css'
import { providerById, providers } from './providers/index.js'
import { alphaMaskFromPaintCanvas, imageMeta, resizeMaskFile, responseImages } from './lib/images.js'
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
}

app.innerHTML = `
  <div class="app">
    <main class="layout">
      <section class="column">
        <section class="identity">
          <div class="wordmark"><span class="mark">id</span><span>Image API Debugger</span></div>
          <div class="status"><span id="statusDot" class="dot"></span><span id="statusText">Ready</span></div>
        </section>

        <section id="connectorCard" class="card collapsed">
          <div class="card-head">
            <h2>Connector</h2>
            <div class="head-actions">
              <button id="testModelsBtn" class="icon-btn" title="Load models" aria-label="Load models">${icons.database}</button>
              <button id="toggleConnectorBtn" class="icon-btn" title="Expand connector" aria-label="Expand connector">${icons.chevronDown}</button>
            </div>
          </div>
          <div class="card-body">
            <div class="field"><label>Base URL</label><input id="baseUrl" value="https://api.videocaptioner.cn"></div>
            <div class="field"><label>API key</label><input id="apiKey" type="password" placeholder="sk-..."></div>
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
            <div class="field"><label>Provider</label><select id="provider">${providers.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}</select></div>
            <div class="field"><label>Model</label><select id="model"><option>gpt-image-2</option><option>gpt-image-1.5</option><option>gpt-image-1</option><option>gpt-image-1-mini</option><option>doubao-seedream-4-0-250828</option><option value="custom">Custom...</option></select></div>
            <div id="customModelWrap" class="field hidden"><label>Custom model</label><input id="customModel"></div>
            <div class="grid-2">
              <div class="field"><label>Size</label><select id="size"><option>1024x1024</option><option>1536x1024</option><option>1024x1536</option><option>auto</option><option value="custom">custom</option></select></div>
              <div class="field"><label>Quality</label><select id="quality"><option>low</option><option selected>medium</option><option>high</option><option>auto</option></select></div>
            </div>
            <div id="customSizeWrap" class="grid-2 hidden">
              <div class="field"><label>Width</label><input id="customWidth" type="number" min="1" max="4096" value="1024"></div>
              <div class="field"><label>Height</label><input id="customHeight" type="number" min="1" max="4096" value="1024"></div>
            </div>
            <div class="grid-2">
              <div class="field"><label>Format</label><select id="outputFormat"><option>png</option><option>jpeg</option><option>webp</option></select></div>
              <div class="field"><label>n</label><input id="count" type="number" min="1" max="4" value="1"></div>
            </div>
            <div class="grid-2">
              <div class="field"><label>Background</label><select id="background"><option>auto</option><option>opaque</option><option>transparent</option></select></div>
              <div class="field"><label>Compression</label><input id="outputCompression" type="number" min="0" max="100" value="90"></div>
            </div>
            <div class="field"><label>Input fidelity</label><select id="inputFidelity"><option value="">Default</option><option value="high">high</option></select></div>
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
              <button id="paintBtn" class="tool active">Paint</button>
              <button id="eraseBtn" class="tool">Erase</button>
              <button id="fillBtn" class="tool">Fill</button>
              <button id="clearMaskBtn" class="tool">Clear</button>
            </div>
            <div class="range-line"><span>Brush</span><input id="brushSize" type="range" min="6" max="180" value="48"><input id="brushNumber" type="number" min="6" max="180" value="48"></div>
            <div id="maskEmpty" class="mask-empty">Upload a source image, then generate a mask canvas. Paint the region to edit.</div>
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
              <button id="validateBtn" class="icon-btn" title="Validate" aria-label="Validate">${icons.check}</button>
              <button id="sendBtn" class="icon-btn primary" title="Send request" aria-label="Send request">${icons.send}</button>
              <button id="abortBtn" class="icon-btn danger" title="Abort request" aria-label="Abort request" disabled>${icons.stop}</button>
              <button id="clearRunsBtn" class="icon-btn" title="Clear history" aria-label="Clear history">${icons.trash}</button>
            </div>
          </div>
          <div class="tabs">
            <button class="tab active" data-tab="request">Request</button>
            <button class="tab" data-tab="response">Response</button>
            <button class="tab" data-tab="history">History</button>
            <button class="tab" data-tab="curl">cURL</button>
          </div>
          <div id="requestTab" class="tab-body"><div class="copy-row"><button class="icon-btn" title="Copy JSON" aria-label="Copy JSON" data-copy="requestPreview">${icons.copy}</button></div><pre id="requestPreview">{}</pre></div>
          <div id="responseTab" class="tab-body hidden"><div class="copy-row"><button class="icon-btn" title="Copy response" aria-label="Copy response" data-copy="responsePreview">${icons.copy}</button></div><pre id="responsePreview">{}</pre></div>
          <div id="historyTab" class="tab-body hidden"><div id="historyList" class="history"></div></div>
          <div id="curlTab" class="tab-body hidden"><div class="copy-row"><button class="icon-btn" title="Copy cURL" aria-label="Copy cURL" data-copy="curlPreview">${icons.copy}</button></div><pre id="curlPreview"></pre></div>
          <div id="proofs" class="proofs"></div>
        </section>
      </section>
    </main>
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
  sourceInput: $('sourceInput'), fileList: $('fileList'), maskCard: $('maskCard'), maskInput: $('maskInput'),
  makeMaskBtn: $('makeMaskBtn'), downloadMaskBtn: $('downloadMaskBtn'), maskImage: $('maskImage'), maskCanvas: $('maskCanvas'),
  sourceMetric: $('sourceMetric'), maskMetric: $('maskMetric'), apiMaskMetric: $('apiMaskMetric'),
  paintBtn: $('paintBtn'), eraseBtn: $('eraseBtn'), fillBtn: $('fillBtn'), clearMaskBtn: $('clearMaskBtn'),
  brushSize: $('brushSize'), brushNumber: $('brushNumber'), requestPreview: $('requestPreview'), responsePreview: $('responsePreview'),
  curlPreview: $('curlPreview'), historyList: $('historyList'), proofs: $('proofs'),
}

function setStatus(text, type = '') {
  els.statusText.textContent = text
  els.statusDot.className = `dot ${type}`.trim()
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
    extra,
  }
}

function currentProvider() {
  return providerById(els.provider.value)
}

function baseUrl() {
  return els.baseUrl.value.trim().replace(/\/+$/, '')
}

function requestData() {
  const provider = currentProvider()
  const providerState = stateForProvider()
  const payload = provider.payload(providerState)
  return {
    provider: provider.id,
    method: 'POST',
    url: `${baseUrl()}${provider.endpoint(providerState)}`,
    contentType: state.mode === 'generate' ? 'application/json' : 'multipart/form-data',
    payload,
    files: state.mode === 'generate' ? [] : state.files.map((file, index) => ({
      field: 'image',
      index,
      name: file.name,
      width: file.width,
      height: file.height,
      bytes: file.bytes,
    })),
    mask: state.mode === 'mask' ? maskSummary() : null,
    validation: validate(false),
  }
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
  if (els.provider.value !== 'openai-images') items.push('This adapter is request-preview only in this build. OpenAI-compatible Images can send live requests.')
  if (activeModel() === 'gpt-image-2' && els.background.value === 'transparent') items.push('gpt-image-2 does not support background=transparent.')
  if (els.background.value === 'transparent' && els.outputFormat.value === 'jpeg') items.push('transparent background requires png or webp.')
  if (state.mode !== 'generate' && !state.files.length) items.push('Edit and Mask require at least one source image.')
  if (state.mode === 'mask' && state.files.length && !state.maskReady && !state.maskFile) items.push('Generate a mask canvas or import a mask before sending.')
  return items
}

function validate(show = true) {
  const errors = []
  if (!activeModel()) errors.push('Model is empty.')
  if (!els.prompt.value.trim()) errors.push('Prompt is empty.')
  const extraJson = parseExtraJson()
  if (extraJson.error) errors.push(extraJson.error)
  if (els.provider.value !== 'openai-images') errors.push('This provider adapter is preview-only in this build.')
  if (activeModel() === 'gpt-image-2' && els.background.value === 'transparent') errors.push('gpt-image-2 does not support background=transparent.')
  if (els.background.value === 'transparent' && els.outputFormat.value === 'jpeg') errors.push('transparent background requires png or webp.')
  if (!baseUrl()) errors.push('Base URL is empty.')
  if (!els.apiKey.value.trim()) errors.push('API key is empty.')
  if (state.mode !== 'generate' && !state.files.length) errors.push('No source images selected.')
  if (state.mode === 'mask' && state.files.length && !state.maskReady && !state.maskFile) errors.push('Mask mode requires a generated or imported mask.')
  const result = { ok: errors.length === 0, errors, warnings: warnings() }
  if (show) {
    if (errors.length) setStatus(errors[0], 'err')
    else if (result.warnings.length) setStatus(result.warnings[0], 'ok')
    else setStatus('Validation passed', 'ok')
  }
  return result
}

function render() {
  els.customModelWrap.classList.toggle('hidden', els.model.value !== 'custom')
  els.customSizeWrap.classList.toggle('hidden', els.size.value !== 'custom')
  els.maskCard.classList.toggle('show', state.mode === 'mask')
  els.maskCard.classList.toggle('ready', state.maskReady || !!state.maskFile)
  els.makeMaskBtn.disabled = !state.files[0]
  els.endpointHint.textContent = `POST ${currentProvider().endpoint(stateForProvider())}`
  els.sourceHint.textContent = state.mode === 'generate' ? 'Optional for generate' : state.mode === 'mask' ? 'Upload source, generate mask, then paint' : 'Required for edit'
  const warningItems = warnings()
  els.warnings.classList.toggle('show', warningItems.length > 0)
  els.warnings.innerHTML = warningItems.map((item) => `<div>${escapeHtml(item)}</div>`).join('')
  els.requestPreview.textContent = JSON.stringify(requestData(), null, 2)
  els.curlPreview.textContent = buildCurl()
  els.estimate.textContent = `$${estimateCost().toFixed(3)} est.`
  updateMaskMetrics()
}

function buildCurl() {
  const req = requestData()
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
  const quality = els.quality.value === 'auto' ? 'medium' : els.quality.value
  const size = els.size.value === 'auto' || els.size.value === 'custom' ? '1024x1024' : els.size.value
  const table = {
    '1024x1024': { low: .006, medium: .053, high: .211 },
    '1536x1024': { low: .005, medium: .041, high: .165 },
    '1024x1536': { low: .005, medium: .041, high: .165 },
  }
  return (table[size]?.[quality] || 0) * (Number(els.count.value) || 1)
}

async function loadSourceFiles(files) {
  state.files.forEach((item) => URL.revokeObjectURL(item.url))
  const selected = Array.from(files || []).filter((file) => file.type.startsWith('image/'))
  state.files = await Promise.all(selected.map((file) => {
    const url = URL.createObjectURL(file)
    return imageMeta(file, url)
  }))
  state.maskReady = false
  renderFiles()
  render()
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

function generateMaskCanvas() {
  const source = state.files[0]
  if (!source) {
    setStatus('Upload a source image first', 'err')
    return
  }
  els.maskImage.src = source.url
  els.maskImage.onload = () => {
    els.maskCanvas.width = source.width
    els.maskCanvas.height = source.height
    clearMask()
    state.maskReady = true
    setStatus(`Mask canvas ${source.width}x${source.height} ready`, 'ok')
    render()
    requestAnimationFrame(syncCanvasSize)
  }
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
  ctx.fillStyle = 'rgba(201,100,66,.5)'
  ctx.beginPath()
  ctx.arc(point.x, point.y, Number(els.brushSize.value) / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
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

async function sendRequest() {
  const check = validate(true)
  if (!check.ok) return
  const provider = currentProvider()
  if (!provider.supportsSend) {
    setStatus('This provider adapter is preview-only in this build', 'err')
    return
  }

  const request = requestData()
  const started = performance.now()
  state.controller = new AbortController()
  document.querySelector('#sendBtn').disabled = true
  document.querySelector('#abortBtn').disabled = false
  setStatus('Sending request...', 'busy')
  try {
    const maskBlob = state.mode === 'mask' ? await apiMaskBlob() : null
    const response = await provider.send({
      baseUrl: baseUrl(),
      apiKey: document.querySelector('#apiKey').value.trim(),
      state: stateForProvider(),
      payload: request.payload,
      files: state.files,
      maskBlob,
      signal: state.controller.signal,
    })
    const latency = Math.round(performance.now() - started)
    document.querySelector('#responsePreview').textContent = JSON.stringify(response.body, null, 2)
    const images = responseImages(response.body, els.outputFormat.value)
    renderProofs(images)
    const run = await saveRun({ ok: true, status: response.status, latency, request, response: response.body, images })
    state.runs = [run, ...state.runs].slice(0, 80)
    renderHistory()
    setStatus(`OK ${response.status} · ${(latency / 1000).toFixed(1)}s`, 'ok')
    switchTab('response')
  } catch (error) {
    const latency = Math.round(performance.now() - started)
    const body = error.body || { error: { message: error.message || String(error) } }
    document.querySelector('#responsePreview').textContent = JSON.stringify(body, null, 2)
    const run = await saveRun({ ok: false, status: error.status || 0, latency, request, response: body, images: [] })
    state.runs = [run, ...state.runs].slice(0, 80)
    renderHistory()
    setStatus(error.message || 'Request failed', 'err')
    switchTab('response')
  } finally {
    state.controller = null
    document.querySelector('#sendBtn').disabled = false
    document.querySelector('#abortBtn').disabled = true
  }
}

function renderProofs(images) {
  els.proofs.innerHTML = images.map((url, index) => `<div class="proof"><img src="${url}" alt="result ${index + 1}"><a href="${url}" download="image-result-${index + 1}.png">Download</a></div>`).join('')
}

function renderHistory() {
  els.historyList.innerHTML = state.runs.map((run) => `<button class="history-item ${run.ok ? 'ok' : 'err'}" data-id="${run.id}"><strong>${run.ok ? 'OK' : 'ERR'} ${run.status} · ${escapeHtml(run.request.payload.model || run.request.provider)}</strong><span>${new Date(run.createdAt).toLocaleString()} · ${(run.latency / 1000).toFixed(1)}s</span><span>${escapeHtml(run.request.payload.prompt || run.request.payload.contents?.[0]?.parts?.[0]?.text || '').slice(0, 140)}</span></button>`).join('')
  els.historyList.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => restoreRun(Number(button.dataset.id))))
}

function restoreRun(id) {
  const run = state.runs.find((item) => item.id === id)
  if (!run) return
  document.querySelector('#responsePreview').textContent = JSON.stringify(run.response, null, 2)
  renderProofs(run.images || [])
  switchTab('response')
  setStatus('History restored. Re-upload source images before resending edit/mask requests.', 'ok')
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab))
  for (const name of ['request', 'response', 'history', 'curl']) document.querySelector(`#${name}Tab`).classList.toggle('hidden', name !== tab)
}

function saveWorkspace() {
  saveConfig({
    baseUrl: document.querySelector('#baseUrl').value,
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
  })
  setStatus('Workspace saved', 'ok')
}

function loadWorkspace() {
  const config = loadConfig()
  for (const [key, value] of Object.entries(config)) {
    const element = document.querySelector(`#${key}`)
    if (element) element.value = value
  }
}

async function loadImageModels() {
  try {
    setStatus('Loading /v1/models...', 'busy')
    const response = await fetch(`${baseUrl()}/v1/models`, { headers: { Authorization: `Bearer ${document.querySelector('#apiKey').value.trim()}` } })
    const body = await response.json()
    if (!response.ok) throw new Error(body?.error?.message || `HTTP ${response.status}`)
    const current = activeModel()
    const ids = Array.from(new Set((body.data || []).filter((model) => {
      const text = JSON.stringify(model).toLowerCase()
      return model.id && (text.includes('image') || text.includes('图像') || text.includes('绘画') || text.includes('gemini') || text.includes('banana'))
    }).map((model) => model.id)))
    els.model.innerHTML = [...new Set(['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', ...ids])].map((id) => `<option>${escapeHtml(id)}</option>`).join('') + '<option value="custom">Custom...</option>'
    if ([...els.model.options].some((option) => option.value === current)) els.model.value = current
    setStatus(`/v1/models OK · ${ids.length} image-like models`, 'ok')
    document.querySelector('#responsePreview').textContent = JSON.stringify(body, null, 2)
    switchTab('response')
    render()
  } catch (error) {
    setStatus(error.message || String(error), 'err')
  }
}

function bind() {
  document.querySelectorAll('.mode').forEach((button) => button.addEventListener('click', () => {
    state.mode = button.dataset.mode
    document.querySelectorAll('.mode').forEach((item) => item.classList.toggle('active', item === button))
    render()
  }))
  document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)))
  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', () => navigator.clipboard.writeText(document.querySelector(`#${button.dataset.copy}`).textContent)))
  document.querySelector('#toggleConnectorBtn').addEventListener('click', () => {
    const card = document.querySelector('#connectorCard')
    card.classList.toggle('collapsed')
    const expanded = !card.classList.contains('collapsed')
    const button = document.querySelector('#toggleConnectorBtn')
    button.innerHTML = expanded ? icons.chevronUp : icons.chevronDown
    button.title = expanded ? 'Collapse connector' : 'Expand connector'
    button.setAttribute('aria-label', button.title)
  })
  document.querySelector('#sourceInput').addEventListener('change', (event) => loadSourceFiles(event.target.files))
  document.querySelector('#maskInput').addEventListener('change', (event) => {
    state.maskFile = event.target.files?.[0] || null
    render()
  })
  document.querySelector('#makeMaskBtn').addEventListener('click', generateMaskCanvas)
  document.querySelector('#downloadMaskBtn').addEventListener('click', async () => {
    try {
      const blob = await apiMaskBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'api-mask.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setStatus(error.message || String(error), 'err')
    }
  })
  document.querySelector('#paintBtn').addEventListener('click', () => setMaskTool('paint'))
  document.querySelector('#eraseBtn').addEventListener('click', () => setMaskTool('erase'))
  document.querySelector('#fillBtn').addEventListener('click', fillMask)
  document.querySelector('#clearMaskBtn').addEventListener('click', clearMask)
  els.brushSize.addEventListener('input', () => { els.brushNumber.value = els.brushSize.value })
  els.brushNumber.addEventListener('input', () => { els.brushSize.value = els.brushNumber.value })
  let drawing = false
  els.maskCanvas.addEventListener('pointerdown', (event) => { drawing = true; els.maskCanvas.setPointerCapture(event.pointerId); paintMask(event) })
  els.maskCanvas.addEventListener('pointermove', (event) => { if (drawing) paintMask(event) })
  els.maskCanvas.addEventListener('pointerup', () => { drawing = false })
  window.addEventListener('resize', syncCanvasSize)
  document.querySelector('#validateBtn').addEventListener('click', () => validate(true))
  document.querySelector('#sendBtn').addEventListener('click', sendRequest)
  document.querySelector('#abortBtn').addEventListener('click', () => state.controller?.abort())
  document.querySelector('#testModelsBtn').addEventListener('click', loadImageModels)
  document.querySelector('#loadModelsBtn').addEventListener('click', loadImageModels)
  document.querySelector('#saveWorkspaceBtn').addEventListener('click', saveWorkspace)
  document.querySelector('#clearRunsBtn').addEventListener('click', async () => { await clearRuns(); state.runs = []; renderHistory(); renderProofs([]); setStatus('History cleared', 'ok') })
  for (const element of document.querySelectorAll('input, select, textarea')) element.addEventListener('input', render)
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
if (state.runs[0]?.images?.length) renderProofs(state.runs[0].images)
render()
