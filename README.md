# Image API Debugger

A static, provider-oriented debugger for image generation and editing APIs.

## Goals

- Build and inspect requests without hiding details behind a toy demo UI.
- Validate source image and mask dimensions before sending edit requests.
- Persist request history locally with IndexedDB.
- Support OpenAI-compatible Images API and Gemini native Nano Banana providers without mixing their protocols.
- Support Codex OAuth image generation through CLIProxyAPI's OpenAI-compatible Images endpoint.
- Deploy as a static GitHub Pages app.

## Features

- Generate, edit, and mask request builder for OpenAI-compatible image endpoints.
- Codex OAuth can be tested through the existing `GPT / OpenAI Images` provider by pointing Base URL at CLIProxyAPI.
- Gemini native `generateContent` support for Nano Banana models, including text-to-image and text+image editing through `inline_data`.
- Multiple source image upload for edit/mask requests.
- Browser mask workflow: upload source image, generate same-size paint canvas, paint/erase/fill, export API mask.
- Request JSON, cURL preview, raw response body, rendered image proofs, local run history.
- Provider-specific request JSON, cURL, response image extraction, and usage-based cost calculation.

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8888
```

## Codex Through CLIProxyAPI

The frontend should not know Codex OAuth credentials. It only calls the OpenAI-compatible Images endpoints exposed by CLIProxyAPI:

- `POST /v1/images/generations`
- `POST /v1/images/edits`

CLIProxyAPI then translates those requests server-side into Codex `POST /backend-api/codex/responses` calls with an `image_generation` tool. That server-side layer owns the Codex OAuth refresh token, access token refresh, Codex headers, and Cloudflare-sensitive user agent behavior.

In this app, use the normal `GPT / OpenAI Images` provider:

- Base URL: `http://127.0.0.1:18317`
- API key: the value in CLIProxyAPI `api-keys`
- Model: `gpt-image-2`

Minimum local config:

```yaml
host: "127.0.0.1"
port: 18317
auth-dir: "~/.cli-proxy-api"
api-keys:
  - "local-dev-key"
passthrough-headers: true
gpt-image-2-base-model: "gpt-5.4-mini"
codex-header-defaults:
  user-agent: "codex-tui/0.135.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.135.0)"
```

Start CLIProxyAPI from the local clone:

```bash
cd /path/to/CLIProxyAPI
go run ./cmd/server -config /path/to/config.yaml
```

Add Codex OAuth credentials in one of these ways:

```bash
# Preferred when logging in fresh through CLIProxyAPI
go run ./cmd/server -config /path/to/config.yaml -codex-login
```

Or convert an existing Codex CLI `~/.codex/auth.json` into CLIProxyAPI's auth-dir shape:

```bash
mkdir -p ~/.cli-proxy-api
jq '{
  type: "codex",
  id_token: .tokens.id_token,
  access_token: .tokens.access_token,
  refresh_token: .tokens.refresh_token,
  account_id: .tokens.account_id,
  last_refresh: .last_refresh
}' ~/.codex/auth.json > ~/.cli-proxy-api/codex-local.json
chmod 600 ~/.cli-proxy-api/codex-local.json
```

The fixed `codex-header-defaults.user-agent` matters for browser use. Without it, CLIProxyAPI may forward the browser user agent to the Codex upstream and trigger a Cloudflare challenge page.

Direct browser calls to `https://chatgpt.com/backend-api/codex/responses` are not reliable because browsers enforce CORS and JavaScript cannot set `User-Agent`. Use CLIProxyAPI or another server-side proxy for actual requests.

## Security

API keys stay in the current browser session field and are not committed to this repository. Workspace settings and run history are stored locally in the browser.

## Architecture

See [docs/architecture.md](docs/architecture.md).
