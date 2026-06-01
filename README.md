# Image API Debugger

A static, provider-oriented debugger for image generation and editing APIs.

## Goals

- Build and inspect requests without hiding details behind a toy demo UI.
- Validate source image and mask dimensions before sending edit requests.
- Persist request history locally with IndexedDB.
- Support OpenAI-compatible Images API and Gemini native Nano Banana providers without mixing their protocols.
- Support Codex OAuth image generation by reproducing CLIProxyAPI's request translation in the browser.
- Deploy as a static GitHub Pages app.

## Features

- Generate, edit, and mask request builder for OpenAI-compatible image endpoints.
- Codex Direct provider for `gpt-image-2`; it accepts Codex auth JSON, refreshes OAuth tokens, and builds Codex Responses `image_generation` tool calls in the browser.
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

## Codex Direct

Codex Direct mirrors CLIProxyAPI's OpenAI Images bridge without requiring a local proxy service:

- Accepts either Codex CLI `~/.codex/auth.json` shape (`tokens.access_token`, `tokens.refresh_token`, `tokens.id_token`, `tokens.account_id`) or CLIProxyAPI auth-file shape (`type: "codex"` plus root-level `access_token`, `refresh_token`, `id_token`, `account_id`).
- Refreshes tokens with `POST https://auth.openai.com/oauth/token`, `client_id=app_EMoamEEZ73f0CkXaXp7hrann`, and `grant_type=refresh_token`.
- Builds `POST https://chatgpt.com/backend-api/codex/responses` with coordinator model `gpt-5.4-mini`, `tool_choice: {type: "image_generation"}`, and one `image_generation` tool containing `action`, `model`, `size`, `quality`, `background`, `output_format`, `output_compression`, `input_fidelity`, and mask data when present.

Because this is a static browser app, browser CORS and forbidden-header rules still apply. The app can reproduce the request body and auth refresh logic, but the upstream must allow browser-origin requests for direct sending to complete. Browsers also do not allow JavaScript to set `User-Agent`; the generated cURL includes it for non-browser testing.

## Security

API keys and Codex auth JSON stay in browser storage and are not committed to this repository. Workspace settings and run history are stored locally in the browser.

## Architecture

See [docs/architecture.md](docs/architecture.md).
