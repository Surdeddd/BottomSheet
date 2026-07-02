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
    <template #button-left><button>←</button></template>
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
| `header` | Header content (receives `{ state }`) |
| (default) | Scrollable content |
| `footer` | Footer content, pinned below the scroll area |
| `button-left` / `button-right` | Buttons docked above the sheet |
| `screen` | Background that fades in by progress |
| `anchor-<id>` | Content for the anchor with matching `id` in the `anchors` prop |

## Events

| Event | Payload |
| --- | --- |
| `change` | `EngineState` (settled state) |
| `snap` | `id: string` |
| `before-snap` | `{ id, size, previousId, cancel }` — call `cancel()` synchronously to veto |
| `open` | `id: string` (enter starts) |
| `opened` | `id: string` (enter settled) |
| `close` | — (exit starts) |
| `closed` | — (exit settled) |
| `before-close` | `{ reason, cancel }` — call `cancel()` synchronously to veto |
| `drag-start` | `{ size }` |
| `drag-end` | `{ size, velocity }` |
| `drag` | `{ size, delta }` (~60 fps) |
| `progress` | `{ value, size }` (~60 fps) |
| `update:open` / `update:snap` | back these with `v-model:open` / `v-model:snap` |

## Two-way binding & reactive props

`v-model:open` and `v-model:snap` bind the open state and active snap id.
`backdropColor`, `backdropOpacity`, `radius`, `maxHeight`, `persistent`,
`disableClose`, `disableDrag`, `snapPoints` (deep) and `allowed` are all
reactive — changing them after mount applies to the live engine.

```vue
<BottomSheet v-model:open="isOpen" v-model:snap="activeSnap" :max-height="cap" />
```

## Teleport

The component renders inside Vue's own `<Teleport>` (`teleport` defaults to
`true`, `teleportTo` to `"body"`). Set `:teleport="false"` to render in place.
In the component path the engine-level DOM relocation is suppressed — only
Vue's `<Teleport>` moves the nodes. (The standalone `useBottomSheet` composable
still uses engine-level relocation via its `teleportTo` option.)

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
