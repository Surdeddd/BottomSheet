# Web Component example — `@surdeddd/bottom-sheet`

Plain HTML page that uses `<bottom-sheet>` directly. The only JS in the
project imports `@surdeddd/bottom-sheet/element` for the side effect of
registering the custom element.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Files

- `index.html` — declares `<bottom-sheet>` with `snap-points`, `initial`, etc.
- `src/main.js` — single side-effect import to register the element + styles.
