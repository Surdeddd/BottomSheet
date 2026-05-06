# Changelog

All notable changes to `@surdeddd/bottom-sheet` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
