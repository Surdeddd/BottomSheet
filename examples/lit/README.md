# Lit example — `@surdeddd/bottom-sheet`

Minimal Lit + Vite playground that wraps the `<bottom-sheet>` web component
inside a `LitElement`. Demonstrates three snap points and the standard
attribute-based API.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Files

- `src/App.ts` — `LitElement` host that renders `<bottom-sheet>` as a child.
- `src/main.ts` — Vite entry, just imports the element to register it.
