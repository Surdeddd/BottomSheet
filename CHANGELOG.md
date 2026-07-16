# Changelog

All notable changes to `@surdeddd/bottom-sheet` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Hidden-at-construction initial-open sheets** — a `fit` / `content` (or any born-open) sheet mounted inside a `display:none` ancestor or detached from the document measured `0` at construction and locked collapsed (~4px) forever. Root cause: `measureSheetNatural`'s no-`scrollContainer` branch measured the element while the engine still pinned its height. Both measurement branches now poke `height: auto` before reading, so the sheet self-heals on reveal (via an `IntersectionObserver` fallback) and emits the full open sequence exactly once. A guard blocks a double `open` / `opened` when `recompute()` lands mid-open-animation.

### Added

- **`__bs: true` history discriminator** — every history entry the library pushes (sheet marker, `routedTo` marker, overlay marker, cancel-restore, internal rebrand) now carries `__bs: true` in `history.state`. A public, documented signal SPA router guards can test to skip the library's same-URL back-stack entries.

### Documentation

- z-index ownership (the stack controller owns inline `z-index` on `.bs-sheet` / `.bs-backdrop` / anchor wrappers), the `vue-router` guard integration pattern, the initial-open contract (born-open visible vs. hidden-at-construction), and the mount-tick `open()` guarantee (no `requestAnimationFrame` delay needed).

## [0.10.0]

### Added — Event parity across every adapter

Every adapter now exposes the full engine event set (previously coverage was
uneven: Vue/Svelte 5 of 9, Qwik 3, Solid 4).

- **React** (hook + component): `onOpen`, `onClose`, `onDrag`, `onProgress` added, alongside the existing `onSnap` / `onBeforeSnap` / `onBeforeClose` / `onOpened` / `onClosed` / `onDragStart` / `onDragEnd`. `onOpen` fires on enter start, `onOpened` after the enter settles.
- **Solid**: `onBeforeClose` (synchronous, working `cancel()`), `onOpen`, `onClose`, `onOpened`, `onClosed`, `onDragStart`, `onDragEnd`, `onDrag`, `onProgress` — full parity with React.
- **Qwik**: lifecycle QRLs `onOpen$`, `onClose$`, `onOpened$`, `onClosed$`, `onDragStart$`, `onDragEnd$` added (alongside `onSnap$` / `onChange$`). See _Limitations_ for the events Qwik intentionally does not expose.
- **Vue**: `drag` and `progress` emits added.
- **Svelte**: `ondrag` and `onprogress` callback props added.
- **Web Component**: `drag` `CustomEvent` added (joining `drag-start` / `drag-end`).

`drag` / `progress` are hot-path: React, Solid and Svelte only subscribe to
them when the handler is provided **at mount** — the engine builds no per-frame
payload otherwise. Adding these handlers after mount has no effect.

### Added — cancelable `before-close` on Solid & Web Component

- **Solid**: `onBeforeClose` runs synchronously and can `cancel()` a dismissal.
- **Web Component**: the `before-close` `CustomEvent` is now cancelable — call `e.preventDefault()` to veto (mirroring `before-snap`).

### Added — Qwik teleport & lifecycle

- `teleport` / `teleportTo` props on the Qwik adapter (opt-in, off by default), mirroring Solid.

### Added — CSS tokens & high contrast

- `--bs-scrim-blur` now applies a real `backdrop-filter: blur()` on the scrim layer (`.bs-screen`) — the token was previously inert.
- `--bs-header-min-height` wired to the `.bs-header` region (default `0px`).
- `@media (forced-colors: active)` block so the sheet surface, handle and focus ring stay visible under Windows High Contrast.

### Added — engine

- `BottomSheetEngine.getResolvedSnaps()` — snapshot of every snap resolved to pixels right now; also exposed on `LinkedSheet`.

### Fixed

- **Overlay backdrop pointer-events** — a transparent backdrop no longer blocks clicks or silently swallows `closeOnBackdrop` / outside-pointer dismissal. `setBackdropOpacity` / `setOverlay` / `open` now resync backdrop `pointer-events`, and a `toast` overlay becoming visible regains interactivity.
- **React component prop types** — `onSnap`, `onBeforeSnap`, `teleportTo`, `backdropColor` and `backdropOpacity` are now typed on `BottomSheetProps` (previously a `TS2322` at the JSX boundary even though the runtime forwarded them).
- **Vue double-teleport** — the SFC drives the composable with `teleport: false`, so only Vue's `<Teleport>` relocates the DOM in the component path; the engine-level relocation no longer fights it. The standalone composable's `teleportTo` is unchanged.
- **visual-viewport vs. in-flight animation** — a soft-keyboard/viewport change during an animation now cancels the in-flight cycle and re-clamps (matching the resize-observer path), instead of the keyboard clamp being overwritten by the next animation tick.
- **linked-sheets size-0 target** — a linked sheet resolves its target to the first allowed snap with resolved size > 0, instead of snapping to a size-0 snap that happened to carry a non-`"closed"` id.

### Changed / Internal

- Engine `maxHeight` state extracted to `max-height-controller.ts`; a `cancelable-emit.ts` primitive backs `before-snap` / `before-close`.
- Overlay types and presets moved to `overlay-options.ts`, React config validation to `config-validation.ts` and the hook's prop-sync effects to `useEnginePropSync.ts` — all re-exported, public import paths unchanged.
- `devWarn` replaces raw `console.warn` in the engine, snap-points, Qwik and overlay — development-only warnings are stripped from production bundles (`NODE_ENV === "production"`).

### Limitations

- **Qwik** does not expose `onDrag$` / `onProgress$` (a QRL is a lazily-resolved reference; invoking one per frame is prohibitively expensive) nor `onBeforeSnap$` / `onBeforeClose$` (a QRL is async, but `cancel()` must be read synchronously right after the emit). Both exclusions are locked by a compile-time test. Use `getEngine()` and subscribe directly if you need per-frame or cancelable hooks in Qwik.

## [0.9.1]

### Fixed

- e2e viewport-resize probe accepts any of the three resize signals (`window.resize`, `visualViewport`, `ResizeObserver`) — Linux WebKit does not dispatch `window.resize`, and the engine relies on `ResizeObserver` / `visualViewport` anyway.

## [0.9.0]

### Added — `before-snap` across adapters

- `before-snap` (cancelable) surfaced on React (`onBeforeSnap`), Vue (`before-snap` emit), Svelte (`onbeforesnap`), Solid (`onBeforeSnap`) and the Web Component (cancelable `CustomEvent`). Qwik is excluded (async QRL cannot drive a synchronous `cancel()`).

### Added — runtime setters & reactive flags

- `BottomSheetEngine.setPersistent`, `setDisableClose`, `setDisableDrag` — flip dismissal/gesture behavior at runtime.
- `persistent` / `disableClose` / `disableDrag` are now reactive on every adapter (React effects, Vue watchers, Svelte `$effect`, Solid `createEffect`, Qwik `useTask$`) and live attributes on the Web Component (`persistent`, `disable-close`, `disable-drag`) — applied without re-init.
- `initialFocus: false` — focus the sheet container (adding `tabindex=-1` if needed) instead of autofocusing the first field; avoids the iOS software keyboard popping up when a sheet with an input opens.

### Added — parity features

- **Teleport for Solid & Svelte** — `teleport` / `teleportTo` props (opt-in, **off by default**, unlike Vue whose default is `body`).
- **`stackEffect`** wired through Svelte, Solid and Qwik (React/Vue already had it via `EngineOptions` passthrough).
- **Button slots for Solid & Qwik** — `leftButton` / `rightButton` (Solid JSX props; Qwik named slots), collapsing when empty.
- The Web Component preserves the active snap across DOM moves and structural re-inits when the id still exists in the new snap-points.

### Fixed

- **content-swipe double-action** — a swipe that actually scrolls the content no longer also nudges the snap (touchend compares `scrollTop` against the touchstart value).
- **Back after a cancelled `before-close`** — the popstate handler awaits `close()`; if `before-close` vetoed it, the history marker is re-pushed so the next Back closes the sheet and the page doesn't navigate away.
- **`opening` flag race** — `newCycle()` resets `opening`, and `snapTo` only clears it after the abort check, so an aborted cycle can't leave a closed sheet reporting `isOpen() === true`.
- **`will-change` leak** — a tap with no movement now clears the compositor `will-change` layer it set on `pointerdown` (both `settleAfterDrag` and `animateTo` early-returns).
- **String `maxHeight` re-resolve** — a `"92dvh"` / `"50%"` cap is re-resolved on viewport / orientation / visual-viewport changes and on `recompute()`, instead of sticking at its first-measured pixel value.
- **Shadow-DOM focus trap** — the Web Component's focus trap now sees slotted light-DOM fields (Tab cycles through them and focus-in no longer yanks focus out of them).
- **Sticky-footer measurement** — `size: 'content'` includes an in-flow `position: sticky; bottom: 0` footer inside `.bs-content` (measured via a `scrollHeight` floor).

### Changed / Internal

- Engine, overlay and Web Component decomposed into focused modules (`teardown-stack.ts`, `overlay-transforms.ts`, `overlay-swipe.ts`, WC `attributes.ts` / `shadow-tree.ts`); `fit`/`content` measurement moved to `fit-measurement.ts` + `fit-observer.ts`.
- React / Vue / Svelte / Solid / Qwik react to post-mount `snapPoints` and `allowed` changes (skip-first-run) — previously a size change was silently ignored and an id change could break `setAllowed`.

## [0.8.2]

### Fixed

- `size: 'content'` includes in-flow sticky footers via a `scrollHeight` floor.

## [0.8.1]

### Fixed

- Vue: `teleport={false}` also suppresses engine-level relocation.

## [0.8.0]

### Fixed

- `size: 'content'` measures the whole sheet (handle + header + content + footer, incl. in-flow sticky children) instead of just handle + content; the numeric `maxHeight` cap survives window / orientation / keyboard resizes; the rubber-band release recoil is restored (no one-frame snap); Solid & Qwik honor `persistent` on backdrop tap and gained `persistent` / `disableClose` / `disableDrag` / `closeOnRouteChange` / `returnFocusTo`.

## [0.7.0]

### Added

- Padding tokens for every region (`--bs-content-padding`, `--bs-handle-padding`, `--bs-header-padding`, `--bs-footer-padding`) — override or zero for edge-to-edge.

### Fixed

- `maxHeight`: a snap taller than the cap no longer shoves the sheet up off its anchor — it settles flush and the body scrolls internally. Solid gained `maxHeight` / `radius` parity.

## [0.6.1]

### Fixed

- Nested z-promote is synchronous for `content` / `fit` / `%` snaps (no one-frame behind-flash); composable `teleportTo` / `backdropColor` added to the Vue & Svelte `.d.ts` templates.

## [0.6.0]

### Added

- Composable options `teleportTo`, `backdropColor`, `backdropOpacity` (React / Vue / Svelte), backed by physical node relocation for the headless composables.

## [0.5.0]

### Added

- `size: 'content'` auto-resizes when its content grows/shrinks; a `footer` slot; `header` moved out of the grabber strip into its own `.bs-header` region.

## [0.4.1]

### Fixed

- Button slots (`leftButton` / `rightButton`) re-parented to `.bs-root` so they are no longer clipped by the sheet's `overflow: hidden` + transform; the engine writes `--bs-size` to the root.

## [0.4.0]

### Added

- Lifecycle & cancelable events (`before-close`, `opened`, `closed`); dismissal options (`persistent`, `disableClose`, `disableDrag`, `closeOnRouteChange`); `isTop()` / `depth()` / `expand()` / `collapse()`; `radius` / `maxHeight`; auto `aria-labelledby`; Vue `v-model` / Teleport / footer / anchors; Svelte & Web Component reactive parity; Web Component host-variable theming.

### Fixed

- `closeOnBack` no longer cascades through nested sheets; content-`fit` + `recompute()`; scrim default dim; synchronous z-promote.

## [0.3.0]

### Added

- Mode-aware `sheet-top-*` scrim positioning; `getEngine()` on all seven adapters; Svelte export condition; typechecked root configs.

### Fixed

- Bumped `devalue` 5.7.1 → 5.8.1 to clear a high-severity DoS advisory (GHSA-77vg-94rm-hx3p).

## [0.2.0]

### Added — Scrim runtime API

- `BottomSheetEngine.setScrimMode('full' | 'above-sheet' | 'off')` — runtime mode flip without remount.
- `BottomSheetEngine.setScrimEnabled(boolean)` — convenience disable/enable.
- `BottomSheetEngine.setScrimTapToClose(boolean)` — runtime install/teardown of click-to-close.
- `BottomSheetEngine.setScrimColor(color | null)`, `setScrimBlur(blur | null)`, `setScrimInteractive(boolean)` — live style mutators.
- `BottomSheetEngine.setBackdropRange([s, e])`, `setScreenRange([s, e])` — opacity range mapping setters.
- `BottomSheetEngine.setScrim(opts)` — batch update with preset + field overrides.
- `BottomSheetEngine.setScrimOverlay(opts)` — inject positioned floating element into scrim area; returns teardown.
- `BottomSheetEngine.getScrimState()` — read-only `{ mode, enabled }` snapshot for introspection without coupling to internal field shape.
- `EngineOptions.scrimPreset` — construction-time preset (`'subtle' | 'standard' | 'monitoring' | 'cinematic'`).
- `EngineOptions.scrimMode: 'off'` — new value to disable scrim.
- New types: `ScrimPreset`, `ScrimUpdate`, `ScrimOverlayOptions`, `ScrimOverlayPosition`, `SCRIM_PRESETS`.

### Added — Overlay runtime API

- `OverlayEngine.setOverlayChildren(node | fragment | factory)` — replace contents at runtime.
- `OverlayEngine.clearOverlayChildren()` — remove injected content.
- `OverlayUpdate.children` — batch field for `setOverlay`.
- `OverlayPreset` ('sheet' | 'dialog' | 'sidebar' | 'toast') with `OVERLAY_PRESETS` const map.

### Changed

- Demo's "Scrim" controls now use runtime setters — no adapter remount on toggle.
- Demo: added "Floating action" toggle demonstrating `setScrimOverlay`.

### Added — Plugin transactional install

- `Plugin.install` now accepts an optional second argument `scope: TeardownScope` with an `add(fn)` method. Plugins that register multiple side effects can push partial cleanups into the scope; engine drains them LIFO if `install` throws, or merges them into the destroy-time `TeardownStack` on success. Plugins ignoring the scope argument keep working unchanged. Exported as `TeardownScope` from the public surface.

### Refactored — internal architecture (no public API changes)

- **ScrimController extracted** — all scrim state (mode, ranges, color/blur, dedup caches, tap-to-close, overlay slot) and 10 setters moved to `src/core/controllers/scrim-controller.ts`. Engine setters become 1-line delegators; `BottomSheetEngine` LOC dropped 1650 → 1261 (-23.6%). Public API surface unchanged.
- **AnimationRunner extracted** — `currentTween`/`currentSpring` lifecycle, `animateTo`, reduced-motion `matchMedia` listener, view-transitions probe moved to `src/core/controllers/animation-runner.ts`.
- **LifecycleController extracted** — open/close install dance (focus-trap + scroll-lock + inert-siblings) shared between `BottomSheetEngine` and `OverlayEngine`. Overlay-specific knobs surfaced as opt-in: `shouldApplyInertSiblings` predicate (overlay's body-descendant guard) and `returnFocus` (focus restoration on dismiss).
- **GestureController extracted** — pointer-event ↔ size-translation pipeline (`onStart/Move/End/Cancel` callbacks, rubber-band clamping, soft-keyboard dismissal, drag-state flags) moved to `src/core/controllers/gesture-controller.ts`. Engine reads `gesture.isDragging` via a getter; `forceClearDragState()` exposed for destroy-mid-drag rollback.
- **AriaSliderWriter extracted** — ARIA `valuemin/max/now/valuetext` attribute writes encapsulated in `src/core/primitives/aria-slider-writer.ts`. Engine owns trigger points; writer owns attribute names and the empty-list strip branch.
- **TeardownStack consolidation** — 8 destroy-only `detachX/releaseX` named fields replaced by a single `teardowns` LIFO stack with per-fn error isolation. Built-in plugins (`installPersist`, `installAutoCollapse`, `installRoute`) AND user `engine.use(plugin)` teardowns now share the same stack — single drain, single error model. Drain rethrows via `queueMicrotask`.
- **`hot-path-thresholds.ts`** primitive — `OPACITY_WRITE_EPSILON` / `SIZE_WRITE_EPSILON` / `POINTER_EVENTS_OPACITY_THRESHOLD` / `RANGE_DIVISION_EPSILON` centralized. Engine + ScrimController import from one place; eliminates drift risk between hot-path consumers.
- **`setScrim()` batch fix** — inner setters (`setScrimMode`, `setScrimEnabled`, `setScrimTapToClose`) now receive a noop callback so `applySize()` runs exactly once per batch instead of up to three times.
- **Drag payload pooling** — `"drag"` event payload is a single reused `{size, delta}` object, mutated each `onMove` instead of allocated per frame. Eliminates ~32B × 60-120Hz GC churn during long drags. Consumers MUST NOT retain the payload reference across frames — clone if persistence needed (mirrors browser PointerEvent semantics). JSDoc on `SheetEventMap.drag` documents the contract.

### Fixed

- **`returnFocus` double-fire on overlay destroy** — `LifecycleController.release()` now short-circuits when not installed, preventing focus restoration from firing twice on `close() → destroy()`. New `installed` / `destroyed` flags seal the controller post-destroy; `setReturnFocus()` after destroy is a no-op.
- **Vue adapter — `state` exposed as readonly** — `defineExpose({ state: readonly(state) })` prevents external write-through that would desync the local view-state from the engine. Mirrors React's getter and Svelte's `getState()` snapshot pattern.
- **`engine.use()` plugin install error isolation** — throws from `plugin.install()` are now caught and rethrown via `queueMicrotask`, so a buggy plugin can't take the engine down with it. Sibling plugins continue to install; the error surfaces in dev tools on the next tick.
- iCloud-Drive duplicate files (`name 2.ext`) stripped from `dist/` via postbuild script.
- Svelte adapter: `aria-modal` toggling and slider `aria-valuemin/max/now` static defaults.
- Vite demo: `optimizeDeps.exclude` for CDN-loaded benchmark libs.

### Tests

- **Cross-adapter contract anchor** (`tests/unit/adapter-contract.test.ts`) — single source of truth `EXPECTED_STATE_KEYS` + `EXPECTED_REF_API` asserted against engine/Vue/React/Solid/Svelte/Web Component/Qwik. Adding a field to `EngineState` fails this test if any adapter forgets to mirror it.
- **Hot-path threshold regressions** (`tests/unit/hot-path-thresholds.test.ts`) — guards `--bs-size`, `--bs-progress`, and backdrop `pointer-events` dedup gates against silent removal during refactors.
- **`returnFocus` single-fire invariant** + plugin transactional rollback + drag payload identity — regression tests on the bug-fix paths above.

## [0.1.0] — initial commit

### Added — Core engine

- `BottomSheetEngine` class — headless, framework-agnostic spring-physics
  sheet with snap-point math, gesture handling, focus trap, scroll lock,
  inert siblings, history integration (`closeOnBack`), and reduced-motion
  support.
- Cycle invariant via `AbortController`: every async path captures the
  current signal at entry and short-circuits if a newer cycle aborted it.
- Modes: `bottom`, `top`, `left`, `right` with axis-correct transform
  templates compiled once in the constructor.
- Snap-point types: `number`, `${number}%`, `'fit'`, `'full'`, and any
  CSS length string (`50dvh`, `clamp(200px, 60%, 800px)`).
- Spring (RK4 integrator with 240 Hz sub-stepping, single DOM write per
  rAF) and tween (eased) animations with named animation presets.
- WCAG 2.1 AA keyboard slider on the handle (`role=slider`,
  `aria-valuemin/max/now`, arrow / Home / End / PageUp / PageDown).
- CSS custom properties: `--bs-progress` (0..1) and `--bs-size` (px) for
  CSS-driven choreography without JS frame work.

### Added — Features (composable `installX` / `createX` factories)

- `installAutoCollapse`, `installContentSwipe`, `installInertSiblings`
- `installLinkedSheets`, `installPersist`, `installRoute`
- `installScrollCache`, `installSliderKeyboard`, `installSoftKeyboard`
- `installResizeObserver`, `installVisualViewport`
- `createSheetManager` — typed route-based sheet registry.
- `sheetStack` — cross-sheet z/scroll-lock coordination.

### Added — Adapters

- React, Vue 3, Svelte 5, Solid, Qwik, Preact, Lit, and a Custom Element
  (`<bottom-sheet>`) auto-registering via the `/element` subpath.
- Form integrations: `/integrations/formik` and
  `/integrations/react-hook-form` (React-only).

### Added — Standalone overlay

- `@surdeddd/bottom-sheet/overlay` subpath: `OverlayEngine`, a slide-up
  panel without snap-point physics (~4 KB gzip).

### Added — Build & tooling

- Multi-entry tsup build with curated `sideEffects` array (literal paths,
  no globs) for tree-shaking.
- Separate IIFE bundle (`element.iife.global.js`) for CDN drop-in usage.
- 253 unit tests (vitest + happy-dom) and 32 e2e tests (Playwright on
  `mobile-chrome`) covering every adapter, a11y (axe-core), pull-to-
  refresh, soft keyboard, viewport resize, and a head-to-head benchmark
  against vaul and react-modal-sheet.
- CI matrix on Node 18 / 20 / 22.
