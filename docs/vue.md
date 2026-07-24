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
`disableClose`, `disableDrag`, `dragFrom`, `dragFromContent`, `snapPoints` (deep) and `allowed` are all
reactive — changing them after mount applies to the live engine.

```vue
<BottomSheet v-model:open="isOpen" v-model:snap="activeSnap" :max-height="cap" />
```

## Opening at mount

The component opens at first render when `open` is already truthy — an
`onMounted` guard calls `open()` when `props.open` is set and the sheet is
closed; `v-model:open` keeps it in sync afterwards. Combine with `initial` for a
specific born-open snap:

```vue
<BottomSheet :open="true" initial="half" :snap-points="snaps" />
```

Composable users don't get the `open` prop — pass `initial` (a snap whose size
resolves `> 0`) to start born-open, or call `open()` inside `onMounted`
directly. Calling `open()` / `snapTo()` synchronously in the mount tick is safe;
no `nextTick` delay is required.

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

## Router guards & `closeOnBack`

`closeOnBack` (and `routedTo`, and overlays) push a history entry so the
hardware / browser Back button closes the top sheet. These are **same-URL**
`pushState` entries, auto-cleaned by the library on close / destroy in any
order. Every entry the library pushes carries `__bs: true` in `history.state` —
a public discriminator.

A global `vue-router` guard sees a `closeOnBack` pop as a same-URL navigation,
which can trip an app-level "unsaved changes?" confirm guard. Skip your guard
for the library's own entries:

```ts
router.beforeEach((to, from) => {
  // __bs marks the library's own history entries (sheet / overlay / routed markers)
  if (window.history.state?.__bs) return true;
  // belt-and-braces: a back-marker pop is a same-URL navigation, and guard
  // timing vs. popstate can vary, so fall back to a path comparison
  if (to.fullPath === from.fullPath) return true;

  return confirmLeaveIfDirty();
});
```

Both lines are intentional: `__bs` is the precise signal (the library's marker
entries), and the `fullPath` equality is the fallback for when the guard runs
before the library's `history.state` is observable.

## Gotchas

- **Don't set `z-index` on `.bs-sheet` / `.bs-backdrop` / anchors.** The stack
  controller rewrites inline `z-index` on these on every stack change (base
  `100`, step `10` per depth), so any value you set is overwritten and races.
  To place the sheet layer against app UI, move the teleport target / `.bs-root`
  parent or change the open order. See [Architecture](ARCHITECTURE.md).
- **Chrome "aria-hidden on an ancestor of the focused element" warning.** The
  library performs **zero** dynamic `aria-hidden` writes; sibling isolation uses
  the `inert` attribute (opt-in via `inertSiblings`, and it skips `.bs-root` /
  `.bs-backdrop` / `.bs-screen`, so stacked sheets never inert each other). If
  you see that warning with stacked sheets, it originates in your own layers
  (router wrappers, another modal library) — not in this library.
