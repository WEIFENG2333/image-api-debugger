# Image API Debugger

A static, provider-oriented debugger for image generation and editing APIs.

## Goals

- Build and inspect requests without hiding details behind a toy demo UI.
- Validate source image and mask dimensions before sending edit requests.
- Persist request history locally with IndexedDB.
- Support OpenAI-compatible Images API first, with adapter slots for Gemini and Nano-Banana style providers.
- Deploy as a static GitHub Pages app.

## Features

- Generate, edit, and mask request builder for OpenAI-compatible image endpoints.
- Multiple source image upload for edit/mask requests.
- Browser mask workflow: upload source image, generate same-size paint canvas, paint/erase/fill, export API mask.
- Request JSON, cURL preview, raw response body, rendered image proofs, local run history.
- Provider abstraction for future Gemini and Nano-Banana adapters.

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8888
```

## Security

API keys stay in the current browser session field and are not committed to this repository. Workspace settings and run history are stored locally in the browser.

## Architecture

See [docs/architecture.md](docs/architecture.md).
