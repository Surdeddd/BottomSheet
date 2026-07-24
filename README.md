# @surdeddd/bottom-sheet

> Universal, headless bottom-sheet engine. **One core, eight adapters, GPU-accelerated, fully tested.**

![bundle](https://img.shields.io/badge/core-%E2%89%A424%20KB%20gzip%20budget-1a1614?style=flat-square)
![slim](https://img.shields.io/badge/slim%20core-%E2%89%A419.5%20KB%20gzip-1a1614?style=flat-square)
![tests](https://img.shields.io/badge/tests-500%2B%20unit-2ea44f?style=flat-square)
![ts](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)
![license](https://img.shields.io/badge/license-MIT-dc3522?style=flat-square)

A framework-agnostic bottom-sheet primitive. Spring physics, Pointer Events,
GPU-only motion, full keyboard a11y, hardware-back interception, multi-sheet
stacking — and the exact same engine behind every adapter.

## 🚀 [Live demo → bottom-sheet-demo.vercel.app](https://bottom-sheet-demo.vercel.app)

📚 [API reference (typedoc) → surdeddd.github.io/BottomSheet](https://surdeddd.github.io/BottomSheet/)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/sheet-dark.png" />
    <img src="docs/screenshots/sheet-light.png" alt="bottom sheet at a mid snap point over a dimmed page" width="420" />
  </picture>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/Surdeddd/BottomSheet/main/docs/gifs/01-drag-to-close.gif" alt="drag to close — spring physics" width="380" />
</p>

<p align="center">
  <img src="docs/assets/architecture.svg" alt="One engine core feeding eight adapters — React, Preact, Vue 3, Svelte, Solid, Qwik, Web Component and Vanilla — plus a standalone /overlay subpath" width="720" />
</p>

## What it does

Every item below is verifiable in this repo's `src/`:

- **8 build targets** — React, Preact, Vue 3, Svelte 5, Solid, Qwik, Web
  Component (Lit-compatible `<bottom-sheet>`) and the vanilla core, plus an
  `/overlay` subpath (standalone slide-up panel).
- **4 axes** — `bottom`, `top`, `left`, `right` (via `mode`).
- **Spring physics with velocity carry**, plus pointer-type-aware tuning
  (separate touch / mouse / pen drag thresholds).
- **Hardware-back interception** on Android — opt-in via `closeOnBack`.
- **`env(safe-area-inset-*)`-aware padding** so action rows clear the home
  indicator.
- **WCAG 2.1 AA keyboard slider** — Arrow/Home/End/Esc stepping, focus trap
  with restore.
- **Multi-sheet stacking** plus a typed sheet-manager registry.
- **Cancelable `before-snap` / `before-close`** — veto a transition
  synchronously.
- Backed by 500+ unit tests across the suite and ~200 Playwright e2e runs
  across three browser engines (`mobile-chrome` / `mobile-safari` /
  `firefox`).

## Install

```bash
npm i @surdeddd/bottom-sheet
```

React / Vue / Svelte are listed as **optional peer deps** — install only
the framework you use, the bundle pays only for that adapter.

## Quick start

### React

```tsx
import { BottomSheet } from '@surdeddd/bottom-sheet/react';
import '@surdeddd/bottom-sheet/styles';

<BottomSheet
  snapPoints={[
    { id: 'minimized', size: 96 },
    { id: 'half', size: '45dvh' },
    { id: 'full', size: '85%' },
  ]}
  initial='minimized'
  animation='spring'
  spring={{ stiffness: 260, damping: 28 }}
  focusTrap
  closeOnEscape
  header={<h2>Search vehicles</h2>}
>
  <YourList />
</BottomSheet>;
```

[Full React docs →](docs/react.md)

### Vue 3

```vue
<script setup>
  import { BottomSheet } from '@surdeddd/bottom-sheet/vue';
  import '@surdeddd/bottom-sheet/styles';
</script>

<template>
  <BottomSheet
    :snap-points="snaps"
    initial="minimized"
    focus-trap
    @snap="onSnap"
  >
    <template #header><h2>Search</h2></template>
    <YourList />
  </BottomSheet>
</template>
```

[Full Vue docs →](docs/vue.md)

### Svelte 5

```svelte
<script lang="ts">
  import { createBottomSheet } from "@surdeddd/bottom-sheet/svelte";
  import "@surdeddd/bottom-sheet/styles";

  let sheetEl: HTMLElement | undefined = $state();
  let handleEl: HTMLElement | undefined = $state();
  let contentEl: HTMLElement | undefined = $state();

  const ctrl = createBottomSheet({
    snapPoints: [{ id: "min", size: 96 }, { id: "full", size: "85%" }],
    initial: "min",
  });

  $effect(() => {
    if (!sheetEl) return;
    return ctrl.attach({ element: sheetEl, handle: handleEl, scrollContainer: contentEl });
  });
</script>

<section class="bs-sheet" bind:this={sheetEl} data-mode="bottom">
  <div class="bs-handle" bind:this={handleEl}><h2>Search</h2></div>
  <div class="bs-content" bind:this={contentEl}><!-- list --></div>
</section>
```

[Full Svelte docs →](docs/svelte.md)

### Web Component (any framework)

```html
<link rel="stylesheet" href="/styles.css" />
<script type="module" src="/element.js"></script>

<bottom-sheet
  snap-points='[{"id":"min","size":96},{"id":"full","size":"85%"}]'
  initial="min"
  animation="spring"
  focus-trap="true"
>
  <h2 slot="header">Search</h2>
  <ul>
    ...
  </ul>
</bottom-sheet>
```

[Full Web-Component docs →](docs/web-component.md)

### CDN — no bundler, no install

Drop-in usage from a static HTML page. The IIFE bundle registers
`<bottom-sheet>` as a side effect — no JS glue required.

```html
<!-- CDN, no bundler -->
<link
  rel="stylesheet"
  href="https://unpkg.com/@surdeddd/bottom-sheet/dist/styles.css"
/>
<script src="https://unpkg.com/@surdeddd/bottom-sheet/dist/element.iife.global.js"></script>
<bottom-sheet
  snap-points='[{"id":"min","size":96},{"id":"full","size":"85%"}]'
  initial="min"
>
  <h2 slot="header">Title</h2>
  <p>Content</p>
</bottom-sheet>
```

### Vanilla core (no framework)

```ts
import { BottomSheetEngine } from '@surdeddd/bottom-sheet';
import '@surdeddd/bottom-sheet/styles';

const engine = new BottomSheetEngine({
  element: document.querySelector('.bs-sheet'),
  handle: document.querySelector('.bs-handle'),
  scrollContainer: document.querySelector('.bs-content'),
  backdrop: document.querySelector('.bs-backdrop'),
  snapPoints: [
    { id: 'min', size: 96 },
    { id: 'full', size: '85%' },
  ],
  animation: 'spring',
});
engine.snapTo('full');
```

[Full vanilla docs →](docs/vanilla.md)

## API at a glance

### Snap points

```ts
type SnapPoint =
  | number // pixels
  | `${number}%` // percent of viewport along the axis
  | 'fit' // natural height of the whole sheet (handle + header + content + footer)
  | 'content' // alias of 'fit'
  | 'full' // 100 % of axis
  | string; // any CSS length — "50dvh", "clamp(200px, 60%, 800px)"
```

### Engine options

| Option               | Default       | What it does                                                                                                               |
| -------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `snapPoints`         | required      | Ordered list of `{ id, size }`                                                                                             |
| `allowed`            | all ids       | Subset the sheet may settle on right now                                                                                   |
| `initial`            | first allowed | Snap id to start at                                                                                                        |
| `mode`               | `"bottom"`    | `bottom`, `top`, `left`, `right`                                                                                           |
| `animation`          | `"spring"`    | `spring`, `tween`, `ios-spring`, `material-bounce`, `linear`, `snappy`                                                     |
| `settleAnimation`    | off           | `"waapi"` — settle runs as a compositor-driven Web Animation (pre-sampled spring keyframes); falls back to rAF automatically |
| `features`           | all defaults  | `EngineFeature[]` — override/extend the composable feature set (see Slim core below)                                       |
| `spring`             | snappy        | `{ stiffness, damping, mass }`                                                                                             |
| `flickVelocity`      | `0.65 px/ms`  | Mobile flick threshold                                                                                                     |
| `dragThreshold`      | `18 px`       | Below this, drag snaps back                                                                                                |
| `rubberBand`         | `true`        | iOS-style soft over-drag                                                                                                   |
| `backdropRange`      | `[0, 1]`      | Progress range over which backdrop fades                                                                                   |
| `screenRange`        | `[0, 1]`      | Progress range over which the `screen`/scrim content fades                                                                 |
| `focusTrap`          | `false`       | Trap Tab focus inside the sheet when open                                                                                  |
| `initialFocus`       | first field   | Element / selector to focus on open; `false` focuses the sheet container (`tabindex=-1`) instead — avoids the iOS keyboard |
| `closeOnEscape`      | `true`        | Listen for Escape and close                                                                                                |
| `closeOnBack`        | `false`       | Intercept Android back button (history.popstate)                                                                           |
| `closeOnRouteChange` | `false`       | Close when the URL changes (patches `pushState`/`replaceState` + popstate)                                                 |
| `lockBodyScroll`     | `true`        | iOS-safe body lock (`position: fixed`)                                                                                     |
| `stackEffect`        | `false`       | iOS card-stack: back sheets scale down per depth                                                                           |
| `inertSiblings`      | `false`       | Mark page siblings `inert` while open (full modal)                                                                         |
| `persistent`         | `false`       | Block dismissal (backdrop / Escape / back); programmatic `close()` still works                                             |
| `disableClose`       | `false`       | Block all closing, including programmatic                                                                                  |
| `disableDrag`        | `false`       | Suppress the drag gesture (imperative snaps still work)                                                                    |
| `dragFrom`           | `"handle"`    | Which regions start a drag: `"handle"`, `"sheet"` (whole sheet), or `"zones"` (only `[data-bs-drag]` subtrees). Defaults to `"sheet"` when no handle is given. `[data-bs-no-drag]` opts a subtree out in every mode. Also `setDragFrom()` / `getDragFrom()` — switching remounts the gesture, no component remount |
| `dragFromContent`    | `true`        | Whether a touch gesture on the scroll container drags the sheet; override per snap point with `{ id, size, dragFromContent: false }`. Also `setDragFromContent()` |
| `radius`             | token default | Corner radius (`string` CSS length or `number` px); also `setRadius()`                                                     |
| `maxHeight`          | none          | Cap the sheet height. `number` (px) or a string (`"92dvh"`, `"50%"`) re-resolved on viewport / orientation changes         |
| `returnFocusTo`      | opener        | Focus target on dismiss — an `HTMLElement`, a selector `string`, or a `() => HTMLElement` factory                          |

### Anchored elements, docked bars & scrim stages

Pin UI around the sheet — it rides the motion on the compositor (zero JS per
frame) and shows/hides per state with configurable animations:

```ts
engine.addAnchor({
  element: closeBtn,
  position: 'sheet-top-right', // rides the sheet edge; 9 screen positions too
  showOn: ['half', 'full'],    // snap ids or a predicate
  animation: 'pop',            // fade | scale | slide | pop | custom keyframes
});

engine.addAnchor({
  element: tabBar,
  position: 'dock-bottom',     // full-width bar; the sheet slides under it
});

engine.setScrimStages({
  stages: [
    { for: 'peek', element: teaser },
    { forRange: [0.5, 1], element: expanded },
  ],
  animation: 'fade',
});
```

[Full anchors & stages docs →](docs/anchors.md)

### Events

```ts
engine.on('snap', ({ id, size, progress }) => {}); // settled state change
engine.on('open', ({ id }) => {}); // 0 → >0 (enter starts)
engine.on('opened', ({ id }) => {}); // enter settled
engine.on('close', () => {}); // → 0 (exit starts)
engine.on('closed', () => {}); // exit settled
engine.on('dragstart', ({ size }) => {});
engine.on('drag', ({ size, delta }) => {}); // ~60 fps — payload is pooled, don't retain
engine.on('dragend', ({ size, velocity }) => {});
engine.on('progress', ({ value, size }) => {}); // ~60 fps

// Cancelable — call cancel() synchronously to veto the transition:
engine.on('before-snap', ({ id, size, previousId, cancel }) => {});
engine.on('before-close', ({ reason, cancel }) => {}); // reason: programmatic | backdrop | escape | back
```

### Imperative

```ts
engine.snapTo('half');
engine.open(); // → first allowed snap with resolved size > 0
engine.close(reason?); // → first snap that resolves to size 0, else first allowed
engine.expand(); // → largest allowed snap
engine.collapse(); // → smallest allowed snap with size > 0
engine.setAllowed(ids, snapId); // dynamic allowlist
engine.setSnapPoints(points); // re-measure
engine.recompute(); // re-measure a 'fit' / 'content' snap on demand
engine.getResolvedSnaps(); // → [{ id, size }] resolved to pixels right now
engine.setPersistent(bool); // toggle persistence (block dismissal) at runtime
engine.setDisableClose(bool); // toggle close-blocking at runtime
engine.setDisableDrag(bool); // toggle the drag gesture at runtime
engine.setRadius('28px'); // corner radius
engine.setMaxHeight('92dvh'); // height cap (re-resolved on viewport change)
engine.canDismiss(); // false when persistent / disableClose
engine.isTop(); // top of the multi-sheet stack?
engine.depth(); // open sheets above this one
engine.destroy(); // remove listeners + cancel animation
```

`initial` starts the sheet **born open** at any snap whose size resolves `> 0`
(no `open` / `opened` event fires — there is no transition to announce). Calling
`open()` / `snapTo()` **synchronously in the mount tick is safe** — no
`requestAnimationFrame` / `nextTick` delay is needed, including `fit` / `content`
and teleported sheets. A sheet mounted hidden (`display:none` ancestor) heals
and emits its open sequence once on reveal. See
[Architecture → Opening at construction](docs/ARCHITECTURE.md).

### Scrim runtime API

The scrim is the dim layer behind/around the sheet (`screenComponent`). All
scrim properties can be mutated at runtime — no remount needed.

| Method                                                 | Purpose                                                                                                                                          |         |                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------- |
| `setScrimMode('full' \                                 | 'above-sheet' \                                                                                                                                  | 'off')` | Switch positioning at runtime. `'off'` fully disables the scrim layer. |
| `setScrimEnabled(boolean)`                             | Convenience switch — stashes/restores opacity ranges.                                                                                            |         |                                                                        |
| `setScrimTapToClose(boolean)`                          | Install/teardown click-to-close on the scrim.                                                                                                    |         |                                                                        |
| `setScrimColor(color \                                 | null)` / `setScrimBlur(blur \                                                                                                                    | null)`  | Live color & backdrop-filter blur. `null` clears.                      |
| `setScrimInteractive(boolean)`                         | Toggle `pointer-events` on the scrim layer.                                                                                                      |         |                                                                        |
| `setBackdropRange([s, e])` / `setScreenRange([s, e])`  | Opacity-range mapping (progress 0..1 → opacity 0..1).                                                                                            |         |                                                                        |
| `setScrim({ ... })`                                    | Batch — applies preset + individual fields in one pass with a single `applySize`.                                                                |         |                                                                        |
| `setScrimOverlay({ children, position, interactive })` | Inject a positioned floating element into the scrim area. Returns a teardown. Useful for monitoring-style "dim everything except this badge" UX. |         |                                                                        |
| `getScrimState()`                                      | Read-only `{ mode, enabled }` snapshot. Stable public API for introspection without coupling to internals.                                       |         |                                                                        |

**Presets**: `'subtle' | 'standard' | 'monitoring' | 'cinematic'` — use via `scrimPreset` constructor option or `setScrim({ preset })`.

### Overlay runtime API

The overlay engine (`@surdeddd/bottom-sheet/overlay`) is a standalone slide-up
panel that mirrors the scrim's runtime-mutability story for content.

| Method                          | Purpose                                                                                         |           |                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `setOverlayChildren(node \      | fragment \                                                                                      | factory)` | Replace overlay contents at runtime. Pass a `Node`, a `DocumentFragment`, or a `() => Node` factory. |
| `clearOverlayChildren()`        | Remove any injected content.                                                                    |           |                                                                                                      |
| `setOverlay({ children, ... })` | Batch update — `children` is one of the accepted fields alongside positioning/preset overrides. |           |                                                                                                      |

**Presets**: `OverlayPreset` is `'sheet' | 'dialog' | 'sidebar' | 'toast'` —
exposed as the `OVERLAY_PRESETS` const map and accepted by `setOverlay({ preset })`.

### Sheet manager (route-based registry)

```ts
import { createSheetManager } from "@surdeddd/bottom-sheet";

const sheets = createSheetManager<"home" | "marker" | "panorama">({
  home:   { snapPoints: [...], allowed: ["min", "half", "full"], onOpen: loadHome },
  marker: { snapPoints: [...], allowed: ["half", "full"],         onOpen: focusMarker, onClose: blur },
});

// In your route watcher:
sheets.transition(prev, next);
const cfg = sheets.resolve(currentRoute); // typed!
```

## Performance

Three deliberate choices keep things 60 fps even on mid-range Android:

1. **Transform-based positioning.** The sheet's `height` is set once to the
   largest snap; size changes apply via `transform: translate3d(...)`. Stays
   on the compositor — zero layout per frame.
2. **Spring sub-stepping with single DOM write.** Stiff springs integrate at
   240 Hz internally for stability, but the engine writes to the DOM exactly
   once per `requestAnimationFrame`.
3. **Settled-state-only React snapshot.** `useSyncExternalStore` refreshes
   only on `snap` / `dragstart` / `dragend`. Drag pixels and animation frames
   propagate via CSS variables (`--bs-progress`, `--bs-size`) and direct
   imperative subscriptions — no React re-renders on every frame.

## Slim core & composable features

The default `BottomSheetEngine` ships every optional behavior preinstalled.
If you only need the essentials, import the slim core (~17.5 KB gzip vs
~23 KB) and register just the features you use:

```ts
import { BottomSheetCore } from '@surdeddd/bottom-sheet/core';
import { routeFeature, contentSwipeFeature } from '@surdeddd/bottom-sheet/features';

const engine = new BottomSheetCore({
  element, handle, snapPoints,
  closeOnBack: true,
  features: [routeFeature(), contentSwipeFeature()],
});
```

Optional features: `routeFeature()` (`closeOnBack` / `routedTo` /
`closeOnRouteChange`), `visualViewportFeature()` (soft-keyboard clamp),
`contentSwipeFeature()`, `persistFeature()`, `autoCollapseFeature()`.
Everything else (gestures, snap math, resize self-heal, a11y slider, focus
trap, scroll lock, scrim, stacking) is core. Setting an option whose feature
is missing dev-warns once and is ignored in production. Custom features
implement `{ name, install(ctx) }` — the same seam the built-ins use.

### Debug overlay

```ts
import { attachDebugOverlay } from '@surdeddd/bottom-sheet/debug';

const detach = attachDebugOverlay(engine);
```

A fixed dev panel showing the active snap, live size/progress, drag/animate
flags and the resolved snap list — driven purely by public engine events,
shipped as its own entry so it costs nothing in app bundles.

### Qwik SSR

The package declares a `qwik` field pointing at
`dist/qwik-lib/index.qwik.mjs`. Qwik apps pick the adapter up automatically
as a vendor root: the consumer optimizer segments it into QRL chunks and
`renderToString` emits a resumable (`q:container="paused"`) sheet. No extra
configuration — `import { BottomSheet } from '@surdeddd/bottom-sheet/qwik'`
keeps working for CSR, and Qwik City SSR now works out of the box.

## Theming

All visuals are driven by CSS custom properties. Override anywhere:

```css
.bs-root {
  --bs-surface: #18181b;
  --bs-handle-color: #71717a;
  --bs-radius: 28px;
  --bs-shadow: 0 -8px 30px rgba(0, 0, 0, 0.6);
}
```

The engine writes `--bs-progress` (0..1) and `--bs-size` (px) to the sheet
element — drive any CSS animation from drag without touching JS:

```css
.fab {
  transform: scale(calc(1 - var(--bs-progress) * 0.3));
}
.map-canvas {
  filter: blur(calc(var(--bs-progress) * 8px));
}
.search-input {
  opacity: calc(1 - var(--bs-progress));
}
```

> **z-index is engine-owned.** The stack controller rewrites inline `z-index` on
> `.bs-sheet`, `.bs-backdrop` and anchor wrappers on every stack change (base
> `100`, step `10` per depth), so a value you set is overwritten and races the
> stack. To position the sheet layer against app UI, move the container
> (teleport target / `.bs-root` parent) or change the open order — don't style
> `z-index` on bs-managed elements. See
> [Architecture → z-index & the sheet stack](docs/ARCHITECTURE.md).

### Scrim, blur & high contrast

| Token                    | Default     | Region                                               |
| ------------------------ | ----------- | ---------------------------------------------------- |
| `--bs-scrim-color`       | transparent | Fill of the scrim layer (`.bs-screen`)               |
| `--bs-scrim-blur`        | `0px`       | `backdrop-filter: blur()` applied to the scrim layer |
| `--bs-header-min-height` | `0px`       | Minimum height of the `.bs-header` region            |

`--bs-scrim-blur` drives a real `backdrop-filter` blur on the scrim — set it
for a frosted backdrop (or use the `monitoring` / `cinematic` scrim presets,
which set both color and blur). Under Windows High Contrast / `forced-colors`
the stylesheet ships a `@media (forced-colors: active)` block so the sheet
surface, handle and focus ring stay visible.

### Padding & layout

Every region's padding is a token — override or zero it to go edge-to-edge.
Defaults match the built-in look. Set the variable on the host / `.bs-root` /
`:root`; custom properties inherit through the Web Component's shadow boundary,
so the same override works for every adapter:

| Token                  | Default               | Region              |
| ---------------------- | --------------------- | ------------------- |
| `--bs-content-padding` | `0 16px 16px`         | scrollable body     |
| `--bs-handle-padding`  | `8px 16px 4px`        | grabber strip (top) |
| `--bs-header-padding`  | `0 16px 8px`          | header slot         |
| `--bs-footer-padding`  | `12px 16px (+ inset)` | footer slot         |

(The footer default is `12px 16px calc(12px + env(safe-area-inset-bottom))` — it
keeps action buttons clear of the home indicator.)

```css
.bs-root { --bs-content-padding: 0; }               /* full-bleed content */
.bs-root { --bs-content-padding: 0 24px 24px; }      /* custom insets        */
bottom-sheet { --bs-handle-padding: 0; }             /* Web Component, from the host */
```

A `maxHeight` (prop, or `max-height` attribute on the element) caps the sheet:
a `'content'` / `'fit'` snap taller than the cap settles flush against the edge
and the body scrolls internally — the sheet never lifts off its anchor and
`--bs-size` always equals the rendered height.

## Demo

```bash
npm run demo
# http://localhost:5173
```

The editorial demo showcases the adapters, every gesture, every mode
(`bottom · top · left · right · overlay`), and live engine readouts (active
snap, progress, velocity, FPS). EN/RU and light/dark toggles in the corner.

## Testing

```bash
npm test                 # 500+ unit tests via vitest + happy-dom
npx playwright test      # e2e via Playwright on mobile-Chrome / mobile-Safari / Firefox
npm run typecheck        # TypeScript --noEmit
```

CI runs all three across Node 20.19 / 22 on every PR and tag.

## Contributing

1. `npm install`
2. `npm run dev` — tsup watch mode
3. `npm run demo` — Vite dev server with live demo
4. `npm test` — vitest watch
5. Open a PR with a focused diff. The CI matrix gates merging.

## License

MIT — see [LICENSE](LICENSE).
