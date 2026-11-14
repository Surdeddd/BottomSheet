# Astro

A sheet needs JavaScript in the browser, so in Astro it is either the custom
element or a framework island.

## The custom element

No framework and no hydration. Register the element from a client script; the
frontmatter runs on the server, where there is nothing to register.

```astro
<button id="filters">Filters</button>

<bottom-sheet snap-points="closed:0,open:fit" focus-trap="true">
  <h2 slot="header">Filters</h2>
  <form>…</form>
</bottom-sheet>

<script>
  import "@surdeddd/bottom-sheet/element";
  import type { BottomSheetElement } from "@surdeddd/bottom-sheet/element";

  const sheet = document.querySelector<BottomSheetElement>("bottom-sheet");
  document.querySelector("#filters")?.addEventListener("click", () => sheet?.open());
</script>
```

The element carries its own styles. See the
[element guide](web-component.md) for attributes, slots and events.

## A framework island

Use the adapter of the framework your project already has. Put the sheet in a
component of that framework and hydrate it:

```tsx
// src/components/Filters.tsx
import { useState } from "react";
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

export default function Filters() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Filters</button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={[{ id: "closed", size: 0 }, { id: "open", size: "fit" }]}
        focusTrap
      >
        …
      </BottomSheet>
    </>
  );
}
```

```astro
---
import Filters from "../components/Filters.tsx";
---

<Filters client:idle />
```

The same works for [Vue](vue.md), [Svelte](svelte.md), [Solid](solid.md) and
[Preact](preact.md).

## Which `client:` directive

- `client:idle` or `client:load` for most sheets.
- `client:visible` hydrates the island when its root scrolls into view. A
  sheet is fixed to the screen, not to the place its root sits in the page, so
  a sheet declared far down the page has no engine until the user scrolls
  there. Use it only when the root is near the top.
- `client:only="react"` skips the server render altogether.

State cannot be shared between islands through props. If a button in one
island opens a sheet in another, keep the trigger and the sheet in the same
component, or use the custom element and call `open()` on it.
