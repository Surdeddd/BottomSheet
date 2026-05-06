# Preact

`@surdeddd/bottom-sheet/preact` is a thin re-export of the React adapter.
It exists so Preact users have a discoverable subpath without having to
know the React adapter works for them too.

## How this works

Preact ships [`preact/compat`](https://preactjs.com/guide/v10/switching-to-preact),
a drop-in shim that exposes React's API surface (hooks, `forwardRef`,
`useImperativeHandle`, etc.) on top of Preact. Once your bundler aliases
`react` → `preact/compat`, the React adapter's internal `import "react"`
calls resolve to Preact and everything works.

The `/preact` subpath is **the same module** as `/react` — `export *`
literally, no wrapper, no extra bytes. Pick whichever import path you
prefer.

## Setup

### 1. Install peers

```bash
npm i preact
# Optional, for SSR:
npm i -D preact-render-to-string
```

### 2. Alias `react` to `preact/compat` in your bundler

#### Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
});
```

The `@preact/preset-vite` plugin sets these aliases automatically — the
explicit block above is the manual equivalent.

#### webpack

```js
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
};
```

### 3. Import and render

```tsx
import { BottomSheet } from "@surdeddd/bottom-sheet/preact";
import "@surdeddd/bottom-sheet/styles";

<BottomSheet
  snapPoints={[
    { id: "min", size: 96 },
    { id: "full", size: "85%" },
  ]}
  initial="min"
>
  <YourContent />
</BottomSheet>;
```

## Gotchas

- Without the `react` → `preact/compat` alias, the import will fail at
  bundle time because the React adapter still has `import "react"` inside.
- Preact's `forwardRef` returns a slightly different object shape than
  React's, but `preact/compat` papers over this — `BottomSheetHandle`
  refs work identically.
- SSR via `preact-render-to-string` works the same way as React's
  `react-dom/server` because the compat shim covers `renderToString`.
