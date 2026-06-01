# Architecture

Image API Debugger is a static Vite app with provider adapters. The app is intentionally browser-only so it can run from GitHub Pages and still let developers point at any OpenAI-compatible base URL.

## Design System

- Warm canvas, ivory panels, terracotta primary actions, and near-black code panels.
- Compact controls and dense request surfaces; decoration is kept behind the task.
- Native form controls are wrapped and styled consistently so the app does not feel like a raw demo page.
- Desktop uses three work lanes: parameters, editing workspace, request inspector.
- Tablet and mobile collapse to one column with no horizontal scrolling.

## Source Layout

- `src/main.js` owns UI state, rendering, event binding, request execution, and validation.
- `src/providers/` contains API adapters. Each adapter exposes protocol metadata, UI option schema, request builders, transport, response usage parsing, and optional estimates.
- `src/lib/images.js` contains browser image utilities, response image extraction, and mask normalization.
- `src/lib/storage.js` contains localStorage workspace config and IndexedDB run history.
- `src/styles.css` is the app-level design system and responsive layout.

## Provider Contract

```js
export const provider = {
  id: 'provider-id',
  label: 'Provider label',
  protocol: 'provider-protocol',
  supportsSend: true,
  supportsMask: false,
  modelOptions: [],
  sizeOptions: [],
  qualityOptions: [],
  endpoint(state) {},
  payload(state) {},
  async send(context) {},
  estimateCost(state) {},
  usageCost(body, model) {},
}
```

Adapters should keep provider-specific request shape in `payload`, auth and HTTP details in `send`, response accounting in `usageCost`, and UI options in schema fields. This keeps Gemini native `generateContent` JSON separate from OpenAI-compatible image generation/edit multipart requests.

## Provider Notes

- OpenAI-compatible Images uses `/v1/images/generations` for generation and `/v1/images/edits` for edit/mask. Edit and mask requests are multipart form data.
- Gemini native uses `/v1beta/models/{model}:generateContent`. Text-to-image is a text part; image editing is text plus `inline_data` image parts. Gemini does not accept OpenAI-style alpha mask files in this adapter.
- Gemini image configuration uses `generationConfig.imageConfig` with `aspectRatio` and `imageSize`, based on the current REST discovery schema and verified requests.

## Mask Rules

The browser paint layer is not sent directly. It is converted to an API mask PNG that matches the first source image dimensions exactly. Painted pixels become transparent in the generated API mask, which is the edit region expected by OpenAI-compatible image edits.
