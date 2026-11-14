# Vue 3

`@surdeddd/bottom-sheet/vue` has a `<BottomSheet>` component and a
`useBottomSheet()` composable for when you want to write the markup yourself.
Vue 3.2 or newer.

```bash
npm i @surdeddd/bottom-sheet
```

## A modal sheet

```vue
<script setup lang="ts">
import { ref } from "vue";
import { BottomSheet } from "@surdeddd/bottom-sheet/vue";
import "@surdeddd/bottom-sheet/styles";

const open = ref(false);
const points = [
  { id: "closed", size: 0 },
  { id: "open", size: "fit" },
];
</script>

<template>
  <button @click="open = true">Filters</button>

  <BottomSheet v-model:open="open" :snap-points="points" focus-trap>
    <template #header><h2>Filters</h2></template>
    <FilterForm />
    <template #footer><button @click="open = false">Apply</button></template>
  </BottomSheet>
</template>
```

`v-model:open` needs a snap point of size `0`; that point is the closed state.
When `open` starts `false` the sheet starts there, and is hidden in the server
markup. A backdrop tap, Escape, the Back button and a drag down all set `open`
to `false`.

## A sheet that stays on screen

```vue
<script setup lang="ts">
import { ref } from "vue";
import { BottomSheet } from "@surdeddd/bottom-sheet/vue";

const snap = ref("peek");
const points = [
  { id: "peek", size: 96 },
  { id: "half", size: "45dvh" },
  { id: "full", size: "90%" },
];
</script>

<template>
  <BottomSheet v-model:snap="snap" :snap-points="points">
    <template #header><h2>Nearby</h2></template>
    <PlaceList @pick="snap = 'full'" />
  </BottomSheet>
</template>
```

`v-model:snap` is the point the sheet rests at. Set it to move the sheet; it is
updated when the sheet settles somewhere else. Without `initial`, the sheet
starts at `snap`.

## Props

Every [engine option](../README.md#options) is a prop, in kebab-case in
templates. The component adds:

| Prop | Default | What it does |
| --- | --- | --- |
| `open` | uncontrolled | Whether the sheet is showing. Use with `v-model:open` |
| `snap` | uncontrolled | The active snap point. Use with `v-model:snap` |
| `backdrop` | `true` | Render the backdrop |
| `close-on-backdrop` | `true` | A tap on the backdrop closes the sheet |
| `teleport` | `true` | Render through Vue's `<Teleport>` |
| `teleport-to` | `"body"` | Where to |
| `anchors`, `scrim-stages` | none | [Anchors and scrim stages](anchors.md). Each anchor has an `id` and takes its content from the `anchor-<id>` slot |
| `aria-label` | `"Bottom sheet"` | Accessible name |
| `handle-label`, `content-label` | English | Accessible names of the handle and the scroll area |

An option you do not pass keeps the engine's default. Vue turns an absent
boolean prop into `false`; the component undoes that, so `lock-body-scroll`,
`close-on-escape`, `rubber-band` and `respect-reduced-motion` are on unless you
write `:lock-body-scroll="false"`.

### Slots

| Slot | What goes in it |
| --- | --- |
| default | The scroll area |
| `header`, `footer` | Regions above and below the scroll area. Both receive `{ state }` |
| `button-left`, `button-right` | Buttons that float above the sheet's leading edge |
| `screen` | Content of the scrim layer; fades in with `progress` |
| `anchor-<id>` | Content of the anchor with that `id` |

### Events

| Event | Payload | When |
| --- | --- | --- |
| `snap` | `id` | The sheet settled on a point |
| `open`, `opened` | `id` | It starts to appear; it has landed |
| `close`, `closed` | nothing | It starts to leave; it is gone. Unmount on `closed` |
| `before-snap` | `{ id, size, previousId, cancel }` | Before a move. `cancel()` stops it |
| `before-close` | `{ reason, cancel }` | Before a close. `reason` is `programmatic`, `backdrop`, `escape` or `back` |
| `drag-start`, `drag-end` | `{ size }`, `{ size, velocity }` | A drag begins and ends |
| `drag`, `progress` | `{ size, delta }`, `{ value, size }` | Every frame of a drag; every frame of any motion |
| `change` | `EngineState` | The reactive state changed |
| `update:open`, `update:snap` | `boolean`, `id` | Behind the two `v-model`s |

`cancel()` must be called synchronously, inside the handler.

### Props you can change after mount

`open`, `snap`, `snapPoints`, `allowed`, `mode`, `radius`, `maxHeight`,
`persistent`, `disableClose`, `disableDrag`, `dragFrom`, `dragFromContent`,
`backdropColor` and `backdropOpacity` are applied to the running sheet.
`snapPoints` is compared by content, so an array written inline does not reset
anything on re-render.

The remaining options, such as `animation` or `focusTrap`, are read once. To
change one of them, give the component a `:key` that changes with it.

## The template ref

```vue
<script setup lang="ts">
const sheet = ref<InstanceType<typeof BottomSheet> | null>(null);
</script>

<template>
  <BottomSheet ref="sheet" :snap-points="points" />
  <button @click="sheet?.expand()">Expand</button>
</template>
```

The ref has `snapTo`, `open`, `close`, `expand`, `collapse`, `setAllowed`,
`setSnapPoints`, `recompute`, `isTop`, `depth`, `canDismiss`, `setRadius`,
`setMaxHeight`, `setScrim`, `setScrimOverlay`, `setScrimColor`,
`setBackdropColor`, `setBackdropOpacity`, `setBackdropRange`, `addAnchor`,
`setScrimStages`, `on`, `getEngine` and a read-only `state`.

`open()` and `snapTo()` are safe to call in `onMounted`; no `nextTick` is
needed.

## The composable

`useBottomSheet()` gives you the refs and the methods and leaves the markup to
you:

```vue
<script setup lang="ts">
import { useBottomSheet } from "@surdeddd/bottom-sheet/vue";

const { sheetRef, handleRef, contentRef, backdropRef, state, snapTo, on } =
  useBottomSheet({ snapPoints: points, initial: "peek" });

on("before-close", ({ cancel }) => {
  if (form.dirty) cancel();
});
</script>

<template>
  <div class="bs-root">
    <div ref="backdropRef" class="bs-backdrop" />
    <section ref="sheetRef" class="bs-sheet" data-mode="bottom" aria-label="Places">
      <div ref="handleRef" class="bs-handle" role="slider" tabindex="0" aria-label="Resize sheet" />
      <div ref="contentRef" class="bs-content">…</div>
    </section>
  </div>
</template>
```

The composable reads its options once, when the component mounts. After that,
change the sheet through what it returns: `setAllowed()`, `setSnapPoints()`,
`setMode()`, `setRadius()` and the rest. `state` is reactive and updates when
the sheet settles and when a drag starts or ends.

The component teleports with Vue's `<Teleport>`. The composable has no
template to teleport, so its `teleportTo` option moves the DOM nodes instead.

## Nuxt and server rendering

The adapter can be imported and rendered on the server. The engine attaches in
`onMounted`. A sheet that starts closed is rendered with
`data-bs-rest="closed"`, which hides it until then.

## Router guards

`closeOnBack` and `routedTo` put an entry in the history so that the Back
button closes the sheet. It is a same-URL `pushState`, removed again when the
sheet closes, and it carries `__bs: true` in `history.state`.

A global guard sees the Back press as a navigation to the same URL. If the
guard asks "leave this page?", let the sheet's own entries through:

```ts
router.beforeEach((to, from) => {
  if (window.history.state?.__bs) return true;
  if (to.fullPath === from.fullPath) return true;
  return confirmLeaveIfDirty();
});
```

The first line is the precise test. The second covers a guard that runs before
`history.state` has changed.

## Things to know

- **Do not set `z-index` on `.bs-sheet`, `.bs-backdrop` or anchors.** The
  engine writes it on every change of the stack. To place the sheets against
  the rest of the app, change the teleport target. See
  [Theming → stacking](theming.md#stacking).
- **"aria-hidden on an ancestor of the focused element".** The library never
  puts `aria-hidden` on your content; it isolates the page with `inert`, and
  only when `inertSiblings` is on. If Chrome prints that warning, it comes
  from another layer of the app.
