# Svelte 5 example — `@surdeddd/bottom-sheet`

Minimal Svelte 5 + Vite playground for the `BottomSheet` adapter, using
runes (`$state`, `$effect`) under the hood. Demonstrates three snap points
(`minimized`, `half`, `full`) with spring physics and Escape-to-close.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Files

- `src/App.svelte` — single SFC using `<BottomSheet>` from `@surdeddd/bottom-sheet/svelte`.
- `src/main.ts` — Vite entry, mounts via Svelte 5 `mount()` API.
- `svelte.config.js` — minimal preprocessor config.
