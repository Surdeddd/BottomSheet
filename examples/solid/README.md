# Solid example — `@surdeddd/bottom-sheet`

Minimal Solid + Vite playground using the headless `BottomSheetEngine` directly
against Solid refs. A ready-made `@surdeddd/bottom-sheet/solid` adapter also
exists — this example shows the lower-level engine wiring (mirroring the
vanilla example); for the component API import `BottomSheet` from
`@surdeddd/bottom-sheet/solid`.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Files

- `src/App.tsx` — Solid component: refs + `onMount` to construct the engine.
- `src/main.tsx` — Vite entry, mounts via `solid-js/web` `render()`.
