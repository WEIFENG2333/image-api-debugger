# Image API Debugger

A static, provider-oriented debugger for image generation and editing APIs.

## Goals

- Build and inspect requests without hiding details behind a toy demo UI.
- Validate source image and mask dimensions before sending edit requests.
- Persist request history locally with IndexedDB.
- Support OpenAI-compatible Images API and Gemini native Nano Banana providers without mixing their protocols.
- Support Codex OAuth image generation through a local CLIProxyAPI bridge.
- Deploy as a static GitHub Pages app.

## Features

- Generate, edit, and mask request builder for OpenAI-compatible image endpoints.
- Codex / CLIProxyAPI provider for `gpt-image-2`; it uses OpenAI Images endpoints on the browser side and CLIProxyAPI translates them to Codex Responses `image_generation` tool calls.
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

## Codex / CLIProxyAPI

The browser talks to a local CLIProxyAPI server, not directly to `chatgpt.com`.

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

For OAuth auth files, CLIProxyAPI expects root-level metadata such as `type: "codex"`, `access_token`, `refresh_token`, `id_token`, and `account_id`. The official Codex CLI file at `~/.codex/auth.json` stores those under `tokens`, so import or convert it into the configured `auth-dir` before starting CLIProxyAPI.

The fixed `codex-header-defaults.user-agent` matters for browser use. Without it, CLIProxyAPI may forward the browser user agent to the Codex upstream and trigger a Cloudflare challenge page.

## Security

API keys stay in the current browser session field and are not committed to this repository. Workspace settings and run history are stored locally in the browser.

## Architecture

See [docs/architecture.md](docs/architecture.md).
