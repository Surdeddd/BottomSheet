# @surdeddd/bottom-sheet · Vue 3

Vue 3.2+ adapter. Ships a `<BottomSheet>` SFC and a `useBottomSheet()`
composable for headless control. Mirrors the React adapter API.

## Install

```bash
npm i @surdeddd/bottom-sheet vue
```

## Component

```vue
<script setup lang="ts">
import { ref } from "vue";
import { BottomSheet } from "@surdeddd/bottom-sheet/vue";
import "@surdeddd/bottom-sheet/styles";

const sheet = ref<InstanceType<typeof BottomSheet> | null>(null);

const onSnap = (id: string) => console.log("settled at", id);
</script>

<template>
  <BottomSheet
    ref="sheet"
    :snap-points="[
      { id: 'minimized', size: 96 },
      { id: 'half',      size: '45%' },
      { id: 'full',      size: '85%' },
    ]"
    initial="minimized"
    animation="spring"
    :spring="{ stiffness: 260, damping: 28 }"
    focus-trap
    close-on-escape
    @snap="onSnap"
  >
    <template #header><h2>Search</h2></template>
    <template #leftButton><button>←</button></template>
    <YourList />
  </BottomSheet>

  <button @click="sheet?.snapTo('full')">Open</button>
</template>
```

## Composable

```ts
import { useBottomSheet } from "@surdeddd/bottom-sheet/vue";

const { sheetRef, handleRef, contentRef, state, snapTo, close } =
  useBottomSheet({ snapPoints, animation: "spring" });
```

## Slots

| Slot | Purpose |
| --- | --- |
| `header` | Drag-handle content |
| (default) | Scrollable content |
| `leftButton` / `rightButton` | Buttons docked above the sheet |
| `screen` | Background that fades in by progress |

## Events

| Event | Payload |
| --- | --- |
| `change` | `EngineState` (settled state) |
| `snap` | `id: string` |
| `open` | `id: string` |
| `close` | — |

## One-shot construction

`useBottomSheet(opts)` reads `opts` once on mount. Changes to `opts.snapPoints`
/ `opts.allowed` / `opts.mode` after the composable has mounted have **no
effect** — the engine doesn't auto-track reactive props. For runtime updates,
use the setters returned from the composable:

```vue
<script setup>
const sheet = useBottomSheet({ snapPoints, allowed, initial: "min" });

// Update allow-list reactively:
watchEffect(() => sheet.setAllowed(formDirty.value ? ["full"] : ["min", "full"]));

// Replace snap geometry:
sheet.setSnapPoints(newPoints);

// Subscribe to engine events the composable doesn't surface by default:
const off = sheet.on("before-snap", e => {
  if (formDirty.value && e.id === "closed") e.cancel();
});
onBeforeUnmount(off);
</script>
```

Engine recreation (changing `mode`, `animation`, `focusTrap`) requires a
`v-if` toggle so the composable re-runs.

## Nuxt 3 / SSR

The composable wraps `onMounted` so the engine attaches only on the client.
No `window` access at import. SSR pages render the static HTML; gestures
activate after hydration.
