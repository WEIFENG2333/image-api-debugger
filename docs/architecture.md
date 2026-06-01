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
- `src/providers/` contains API adapters. Each adapter exposes `id`, `label`, `supportsSend`, `endpoint(state)`, `payload(state)`, and optionally `send(context)`.
- `src/lib/images.js` contains browser image utilities, response image extraction, and mask normalization.
- `src/lib/storage.js` contains localStorage workspace config and IndexedDB run history.
- `src/styles.css` is the app-level design system and responsive layout.

## Provider Contract

```js
export const provider = {
  id: 'provider-id',
  label: 'Provider label',
  supportsSend: true,
  endpoint(state) {},
  payload(state) {},
  async send(context) {},
}
```

Adapters should keep provider-specific request shape in `payload` and transport details in `send`. This keeps Gemini, Nano-Banana, and OpenAI-compatible image providers isolated from UI state.

## Mask Rules

The browser paint layer is not sent directly. It is converted to an API mask PNG that matches the first source image dimensions exactly. Painted pixels become transparent in the generated API mask, which is the edit region expected by OpenAI-compatible image edits.
