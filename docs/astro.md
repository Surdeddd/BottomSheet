# @surdeddd/bottom-sheet · Astro (recipe)

Astro has zero-JS by default — bottom sheets need client-side interaction.
Use `client:visible` (or `client:idle`) to hydrate the island only when needed.

## Pick your framework

Astro hosts React, Vue, Svelte, Solid. Pick whichever you already use; all
adapters work the same as in their native projects.

### React inside Astro

```astro
---
// src/pages/index.astro
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";
---

<BottomSheet
  client:visible
  snapPoints={[
    { id: "min", size: 96 },
    { id: "half", size: "45%" },
    { id: "full", size: "85%" },
  ]}
  initial="min"
  animation="spring"
>
  <YourList />
</BottomSheet>
```

### Vue inside Astro

```astro
---
import BottomSheet from "../components/MyBottomSheet.vue";
import "@surdeddd/bottom-sheet/styles";
---

<BottomSheet client:idle />
```

### Web Component inside Astro (no framework needed)

```astro
---
import "@surdeddd/bottom-sheet/element";
---

<link rel="stylesheet" href="/styles.css" />
<bottom-sheet
  snap-points='[{"id":"min","size":96},{"id":"full","size":"85%"}]'
  initial="min"
>
  <h2 slot="header">Search</h2>
  <ul>
    <li>Item 1</li>
  </ul>
</bottom-sheet>

<script>
  document.querySelector("bottom-sheet")?.addEventListener("snap", (e) => {
    console.log("snap", (e as CustomEvent).detail.id);
  });
</script>
```

The Web Component approach has zero hydration overhead — Astro never sees a
React/Vue tree to manage.

## Notes

- `client:visible` is preferred over `client:load` for sheets — they only
  matter once visible.
- For SSR-rendered shells (Server Islands), set `noSSR` on the React adapter
  to skip server render of the sheet — it'll mount on the client only.
