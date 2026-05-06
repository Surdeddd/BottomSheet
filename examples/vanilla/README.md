# Vanilla example — `@surdeddd/bottom-sheet`

Pure TypeScript + Vite playground. Uses the headless `BottomSheetEngine`
against raw DOM nodes — no framework, no adapter. Demonstrates three snap
points and click-to-close on the backdrop.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Files

- `index.html` — `.bs-root > .bs-backdrop + .bs-sheet` skeleton.
- `src/main.ts` — instantiates `BottomSheetEngine` against the DOM nodes.
