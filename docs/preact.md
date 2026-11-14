# Preact

`@surdeddd/bottom-sheet/preact` is the React adapter. Preact runs it through
[`preact/compat`](https://preactjs.com/guide/v10/switching-to-preact), which
provides the React API the adapter imports. The entry re-exports `/react` and
adds nothing to it, so everything in the [React guide](react.md) applies:
props, callbacks, the ref and the hook.

```bash
npm i @surdeddd/bottom-sheet preact
```

## Setup

The adapter contains `import … from "react"`. Your bundler has to point that
at `preact/compat`.

With Vite, `@preact/preset-vite` does it for you:

```ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({ plugins: [preact()] });
```

Without the preset, or in webpack, write the aliases yourself:

```js
resolve: {
  alias: {
    react: "preact/compat",
    "react-dom": "preact/compat",
    "react/jsx-runtime": "preact/jsx-runtime",
  },
}
```

## Usage

```tsx
import { useState } from "preact/hooks";
import { BottomSheet } from "@surdeddd/bottom-sheet/preact";
import "@surdeddd/bottom-sheet/styles";

export function Filters() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Filters</button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "open", size: "fit" },
        ]}
        focusTrap
        header={<h2>Filters</h2>}
      >
        <FilterForm />
      </BottomSheet>
    </>
  );
}
```

## Things to know

- Without the alias the build fails with an unresolved `react` import.
- Server rendering works with `preact-render-to-string`, the same way as with
  `react-dom/server`.
