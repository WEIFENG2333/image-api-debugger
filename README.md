# Image API Debugger

A browser debugger for image generation and editing APIs. It shows the exact request, response, headers, generated images, usage cost, and local history.

## Use The App

Open the hosted app:

```text
https://bkfeng.top/image-api-debugger/
```

Or run locally:

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8888
```

## Providers

### GPT / OpenAI Images

Use this for OpenAI-compatible image APIs, including CLIProxyAPI.

```text
Provider: GPT / OpenAI Images
Base URL: https://api.example.com/v1
API key: your-api-key
Model: gpt-image-2
```

Supported workflows:

- Generate: `POST {Base URL}/images/generations`
- Edit and Mask: `POST {Base URL}/images/edits`

The app uses Base URL exactly as entered. It does not auto-append or validate path prefixes.

### Gemini

Use this for Gemini native `generateContent` image models.

```text
Provider: Gemini
Base URL: https://generativelanguage.googleapis.com
API key: your Gemini API key
Model: gemini-3.1-flash-image
```

## Codex via CLIProxyAPI

For Codex image generation, do not put Codex OAuth credentials in this frontend. Run CLIProxyAPI locally, then connect this app to CLIProxyAPI through the normal `GPT / OpenAI Images` provider.

In the app:

```text
Provider: GPT / OpenAI Images
Base URL: http://127.0.0.1:8317/v1
API key: the key in CLIProxyAPI api-keys
Model: gpt-image-2
```

CLIProxyAPI exposes OpenAI-compatible image endpoints:

- `POST /v1/images/generations`
- `POST /v1/images/edits`

It translates those requests server-side into Codex `POST /backend-api/codex/responses` calls with an `image_generation` tool. Token refresh, Codex OAuth credentials, and Codex-specific headers stay inside CLIProxyAPI.

### Install CLIProxyAPI

Official quick start:

macOS:

```bash
brew install cliproxyapi
brew services start cliproxyapi
```

Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/router-for-me/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash
```

Docker:

```bash
docker run --rm -p 8317:8317 \
  -v /path/to/config.yaml:/CLIProxyAPI/config.yaml \
  -v /path/to/auth-dir:/root/.cli-proxy-api \
  eceasy/cli-proxy-api:latest
```

Windows: download the latest binary from GitHub Releases.

### Minimal Config

Create or edit the CLIProxyAPI config file.

For Homebrew service, the default path is usually:

```text
/opt/homebrew/etc/cliproxyapi.conf
```

Minimal local config:

```yaml
host: "127.0.0.1"
port: 8317
auth-dir: "~/.cli-proxy-api"
api-keys:
  - "local-dev-key"
passthrough-headers: true
gpt-image-2-base-model: "gpt-5.4-mini"
codex-header-defaults:
  user-agent: "codex-tui/0.135.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.135.0)"
```

Then use this app with:

```text
Base URL: http://127.0.0.1:8317/v1
API key: local-dev-key
```

### Add Codex Login

Fresh login through CLIProxyAPI:

```bash
cliproxyapi -codex-login
```

If you installed from source, run:

```bash
go run ./cmd/server -config /path/to/config.yaml -codex-login
```

If you already have `~/.codex/auth.json`, you can import it:

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

## Why A Proxy Is Needed

Direct browser calls to `https://chatgpt.com/backend-api/codex/responses` are blocked by browser CORS, and JavaScript cannot set `User-Agent`. CLIProxyAPI avoids this by running server-side and exposing browser-friendly OpenAI-compatible endpoints.

## Features

- Generate, edit, and mask request builder.
- Multi-image upload for edit and mask requests.
- Browser mask painter with same-size API mask export.
- Request JSON, cURL, raw response, response headers, image preview, and history.
- Local persistence with IndexedDB and browser storage.
- Usage-based cost display when the API returns usage metadata.

## Security

API keys are stored only in your browser storage. Codex OAuth credentials should stay in CLIProxyAPI, not in this frontend.

## Architecture

See [docs/architecture.md](docs/architecture.md).
