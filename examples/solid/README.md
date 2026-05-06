# Solid example — `@surdeddd/bottom-sheet`

Minimal Solid + Vite playground using the headless `BottomSheetEngine` directly
against Solid refs. There is no `@surdeddd/bottom-sheet/solid` adapter — Solid
users wire the engine to raw DOM refs (mirroring the vanilla example).

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Files

- `src/App.tsx` — Solid component: refs + `onMount` to construct the engine.
- `src/main.tsx` — Vite entry, mounts via `solid-js/web` `render()`.
