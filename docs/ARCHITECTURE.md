# Architecture

`@surdeddd/bottom-sheet` is a headless, framework-agnostic bottom-sheet
engine with adapters for React, Vue, Svelte, Solid, Qwik, Preact, Lit, and
a Custom Element. This document explains the layer model, the cycle
invariant that keeps async operations consistent, the feature-factory
pattern that composes the engine, and the plugin contract.

## Layer model

```
┌─────────────────────────────────────────────────────────────────┐
│  integrations/  (formik, react-hook-form)                       │
│      ↓ depends on adapter                                       │
├─────────────────────────────────────────────────────────────────┤
│  react/  vue/  svelte/  solid/  qwik/  preact/  lit/            │
│  web-component/                                                  │
│      ↓ depends on core                                          │
├─────────────────────────────────────────────────────────────────┤
│  core/                                                           │
│  ├── BottomSheetEngine  ← orchestrator class                    │
│  ├── overlay            ← simpler slide-up panel                │
│  │   (OverlayPreset · setOverlayChildren · OverlayUpdate)       │
│  ├── gestures           ← pointer events + velocity tracking    │
│  ├── types              ← public type surface                   │
│  ├── controllers/       ← stateful sub-engines owned by Engine  │
│  │   └── scrim-controller (color/blur/mode/range/tap-to-close)  │
│  ├── primitives/        ← pure helpers, no DOM mutation         │
│  │   ├── event-bus, instance-id                                 │
│  │   ├── transform, rubber-band                                 │
│  │   ├── snap-points (incl. findDragSettleTarget)               │
│  │   ├── hot-path-thresholds (CSSOM-write dedup epsilons)       │
│  │   └── cssLength (DOM probe)                                  │
│  ├── animation/         ← physics + tween + presets             │
│  │   ├── animation (tween + easings)                            │
│  │   ├── spring (RK4 integrator)                                │
│  │   └── animation-presets (named configs)                      │
│  ├── lifecycle/         ← modal-state primitives                │
│  │   ├── focusTrap, scrollLock                                  │
│  │   └── sheetStack, sheetManager                               │
│  └── features/          ← composable installX() factories       │
│      ├── auto-collapse, content-swipe, inert-siblings           │
│      ├── linked-sheets, persist, route, scroll-cache            │
│      ├── slider-keyboard, soft-keyboard, resize-observer        │
│      └── visual-viewport                                         │
└─────────────────────────────────────────────────────────────────┘
```

Arrows point in the **import direction**. `core/` never imports from
adapters. Adapters import directly from `core/...` (relative paths) — they
do NOT route through the public barrel, so consumer bundles aren't dragged
through the entire surface.

## Controllers (sub-engines)

`controllers/` holds stateful collaborators that the engine *owns* but
delegates to. They differ from `features/` in that they hold persistent
state (own private fields, hot-path caches) rather than installing a
self-contained side-effect with a teardown function.

**`ScrimController`** (`src/core/controllers/scrim-controller.ts`) owns
all scrim concerns: `screenComponent`/`backdrop` opacity, mode (`'full' |
'above-sheet' | 'off'`), color/blur, tap-to-close, the positioned overlay
slot, and the per-frame opacity-write dedup caches. The engine instantiates
one `ScrimController` in its constructor and forwards every `setScrim*`
public method as a thin delegator. Engine's `applySize` calls
`this.scrim.applyOpacity(progress)` per frame instead of inlining the
backdrop+screen opacity branches. `engine.getScrimState()` returns a
read-only snapshot for introspection.

This split keeps `BottomSheetEngine` focused on snap math + animation +
lifecycle while the dim-layer state machine lives elsewhere. Public API
unchanged.

## The engine

`BottomSheetEngine` (≈1260 lines after the ScrimController extraction) is a
single class that owns:

- snap-point math (resolved sizes from CSS lengths)
- gesture handling (drag → flick → settle, rubber-band, content-swipe)
- animation (spring + tween, with reduced-motion + view-transitions paths)
- ARIA value/orientation attributes on the slider handle
- lifecycle (open/close, focus trap, scroll lock, inert siblings)
- history integration (closeOnBack, routedTo)
- scrim mode + opacity (full / above-sheet / off, presets)

The engine renders **nothing** on its own — it applies size to a host
element via the chosen `mode` axis and emits events. Adapters subscribe to
`engine.on(event, fn)` and mirror the state into their reactive system.

## The cycle invariant

Every async operation captures `currentAbort.signal` at entry; after each
await, it checks `signal.aborted` and bails if a newer cycle has aborted
the controller.

```ts
async snapTo(id: string): Promise<void> {
  if (this.destroyed) return;
  const signal = this.newCycle();      // aborts prior controller, returns new signal
  await this.animateTo(target.size);   // animation runs; resize/destroy/concurrent
                                        // snapTo can call newCycle() again, which
                                        // flips `signal.aborted` to true
  if (signal.aborted) return;          // post-await guard short-circuits stale path
  this.emit("snap", { id, size });     // safe to fire — we own this cycle
}
```

`newCycle()` is called on:
- `snapTo` / `dragTo` / `settleAfterDrag` entry
- viewport resize (clamps maxAxisSize)
- `setAllowed` / `setSnapPoints` (geometry change)
- `handleOpen` failure path (rolls back open state)

`destroy()` does a **terminal abort**: aborts the controller without
creating a fresh one, so any captured signal sees `aborted=true` for the
rest of the engine's life.

External `AbortSignal` (passed via `snapTo({ signal })`) wires into the
same machinery: an external abort fires `currentTween/currentSpring.cancel()`
+ `newCycle()`, so the captured signal flips and the post-await guard
short-circuits without firing `emit("snap")`.

This pattern replaces the older numeric `cycleNonce` with standard browser
abort semantics — see commit history for migration details.

## Opening at construction

A sheet is **born open** when `initial` names a snap whose size resolves `> 0`
at construction — a px / `%` value, or a `fit` / `content` snap whose content
already has layout. Two paths:

- **Visible at construction** — the initial size resolves `> 0` synchronously.
  The engine installs lifecycle (focus trap, scroll lock), pushes the
  `closeOnBack` history marker and promotes the sheet in the stack **at
  construction**, but stays **silent**: no `open` / `opened` events fire (the
  sheet was never closed, so there is no transition to announce).
- **Hidden at construction** — the sheet is mounted under a `display:none`
  ancestor or detached from the document, so `fit` / `content` measures `0` and
  it can't lay out yet. The engine registers an `IntersectionObserver` fallback;
  on first reveal it re-measures, heals the active snap, and **then** emits the
  full open sequence exactly once (`open` + `opened`, `closeOnBack` marker,
  stack promotion). A guard (`isInstalled` / `opening` / `isAnimating`) prevents
  a double emit when a `recompute()` lands mid-animation.

`measureSheetNatural` (`src/core/features/fit-measurement.ts`) pokes
`height: auto` on **both** measurement branches before reading natural size — a
hidden-mounted `fit` sheet used to lock at its pinned collapsed height forever
because the no-`scrollContainer` branch measured while the engine still pinned
the height.

Calling `open()` / `snapTo()` **synchronously in the mount tick works** across
`fit`, teleport and hidden-host cases — consumers do **not** need a
`requestAnimationFrame` / `setTimeout` / `nextTick` delay before the first
imperative open.

## z-index & the sheet stack

`sheetStack` (`src/core/lifecycle/sheetStack.ts`) owns z-index. On **every**
stack change — open (promote), settle, close, destroy — it rewrites **inline**
`z-index` on the managed elements from a base of `100`, stepping `10` per stack
position:

| Element | z-index |
|---|---|
| `.bs-sheet` | stack `z` (`100 + 10·position`) |
| `.bs-backdrop` | `z − 1` |
| anchor wrappers | `z + 1` |

Because these writes land on every stack change, a consumer-set `z-index` on any
bs-managed element is overwritten — or survives only until the next stack
change, so it races. **Never style `z-index` on bs-managed elements.** To place
the whole sheet layer relative to app UI, control the container (the teleport
target or the `.bs-root` parent) or the open order instead.

## Feature factories

Features in `src/core/features/*` follow a strict pattern:

1. Take a typed `Deps` interface as the only constructor argument
2. Wire DOM listeners / observers / timers using only the deps
3. Return a teardown `() => void` (or a handle object for stateful features)

Since the slim-core split, the OPTIONAL subset of these (route,
visual-viewport, content-swipe, persist, auto-collapse) is registered
through the `EngineFeature` seam instead of hardwired constructor calls:
`BottomSheetCore` runs `opts.features` in two stages ("attach" installs at
the historical content-swipe position, "post" at the constructor tail,
preserving listener order), dedupes by `name` (last wins), and dev-warns
when an option like `closeOnBack` is set without its feature. The default
`BottomSheetEngine` subclass (`src/core/BottomSheetEngine.ts`) prepends
`defaultEngineFeatures()` so the full engine is behaviorally identical to
the pre-split one. `EngineFeatureContext` exposes the same lazy accessors
the old inline deps closures used — features must not cache values from it
at install time.

Example:

```ts
export type AutoCollapseDeps = {
  ms: number | undefined;
  isDestroyed: () => boolean;
  isDragging: () => boolean;
  getAllowedIds: () => string[];
  getActiveId: () => string;
  resolveSnap: (id: string) => { id: string; size: number } | null;
  snapTo: (id: string) => void;
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
};

export function installAutoCollapse(deps: AutoCollapseDeps): () => void {
  // ... timer wiring ...
  return () => {
    // teardown
  };
}
```

The engine's constructor wires features and pushes their teardowns into
`pluginTeardowns`. `destroy()` drains the array LIFO with per-feature
try/catch — one buggy feature can't take down siblings or the engine.

### Naming convention

| Pattern | Return type | Example |
|---|---|---|
| `installX(deps)` | teardown `() => void` | `installAutoCollapse`, `installRoute`, `installResizeObserver` |
| `createX(deps)` | handle object | `createInertSiblings`, `createScrollCache` |
| `notifyX(...)` | one-shot pure function | `notifyLinkedSheets` |

`attachGestures` is preserved as a deprecated alias of `installGestures`
during the v1 → v2 migration window. See `docs/migration-v2.md`.

## Plugin contract

`engine.use(plugin)` registers a plugin:

```ts
export type Plugin = {
  name: string;
  install: (engine: BottomSheetEngine) => void | (() => void);
};
```

Guarantees:

- `install` runs **once**, **synchronously**, AFTER the constructor finishes
- The engine is fully initialised when `install` is called
- Plugins may subscribe to events via `engine.on(...)` and call any public
  method
- Plugins should NOT call `engine.destroy()` from within `install`
- Plugin teardowns are drained LIFO in `destroy()` with error isolation

See `docs/plugins.md` for a worked example.

## Hot-path optimisations

The engine's drag/animate path runs at 60–120 Hz. These caches were added
to keep per-frame work to single-digit microseconds:

| Cache | Built | Purpose |
|---|---|---|
| `transformTemplate` | once in constructor | replaces `switch(mode)` per frame with a closure call |
| `allowedRangeCache` | invalidated on geometry/allow-list change | replaces `O(n)` iteration of `resolvedSnaps` per frame with `O(1)` lookup |
| `reducedMotion` | live media-query listener | replaces `window.matchMedia()` call per `animateTo` |
| `viewTransitionsAvailable` | once in constructor | replaces `typeof document.startViewTransition` probe per `snapTo` |
| `lastBackdropOpacity` / `lastScreenOpacity` | per-frame | sub-pixel dedup — skips CSSOM writes when delta < 0.005 |

`applySize()` runs every animation frame. It writes:
- `style.transform` (via `transformTemplate(offset)`)
- `--bs-size` and `--bs-progress` CSS custom properties
- `backdrop.style.opacity` (deduped)
- `screenComponent.style.opacity` (deduped)
- emits `progress` event ONLY when listeners exist

## Subpath exports

Consumer-facing imports:

| Subpath | What you get | Notes |
|---|---|---|
| `@surdeddd/bottom-sheet` | Core engine + utilities | Barrel; some helpers marked `@internal` |
| `@surdeddd/bottom-sheet/overlay` | OverlayEngine without the bottom-sheet engine | Standalone slide-up panel; ≤7 KB gzip `size-limit` budget |
| `@surdeddd/bottom-sheet/element` | Custom Element with auto-registration | Async side effect — see W11 in audit notes |
| `@surdeddd/bottom-sheet/{react,vue,svelte,solid,qwik,preact}` | Framework adapters | `size-limit` gzip budgets: react 26, vue/svelte 22, solid/qwik 20.5, preact ~1 (re-export) |
| `@surdeddd/bottom-sheet/integrations/{formik,react-hook-form}` | React-form bindings | Field-aware wrappers; depend on the React adapter |

`package.json` `sideEffects` array is curated to literal paths (no globs):
CSS files + the `element.{js,cjs,iife.global.js}` are side-effecting; all
other entries are pure for tree-shaking.

## Things that are intentionally NOT done

- **No `splitting: true` in tsup.** Tried; chunk overhead exceeds the
  engine duplication savings for the typical single-adapter consumer.
- **No per-frame view-transitions.** The View Transitions API is designed
  for discrete state changes; wrapping the spring/tween loop would either
  flood the browser with snapshots or stall the animation.
- **No reverse imports from adapters into `core/`.** Adapters extend
  `EngineOptions`; the engine never knows what framework wraps it.
- **No async `cancel()` in `before-snap`.** The cancel callback is frozen
  after the synchronous emit phase — async cancels emit a console.warn
  and are ignored.
- **No mutable global state in `core/`.** Aside from the SSR-fallback
  counter in `instance-id.ts` (which is per-prefix and bounded), all
  state is per-engine instance.

## Test layout

- `tests/unit/*.test.ts` — vitest + happy-dom; 500+ tests covering engine
  behaviour, gestures, focus trap, scroll lock, snap math, persist,
  auto-collapse, linked sheets, plugin system, dragTo, scroll cache,
  AbortSignal API, ARIA slider attributes, route mount-time push.
- `tests/e2e/*.spec.ts` — Playwright on `mobile-chrome` / `mobile-safari` /
  `firefox`; covers adapters, a11y (axe-core), pull-to-refresh, soft keyboard,
  viewport resize, visual regression, and head-to-head benchmark vs.
  vaul / react-modal-sheet.
- `tests/benchmark/` — auto-generated by `npx playwright test
  benchmark.spec.ts` (gitignored output).

## Further reading

- `docs/plugins.md` — plugin contract with a worked analytics-tracker example
- `docs/migration-v2.md` — planned breaking changes for v2
- `docs/{framework}.md` — per-adapter usage docs
- `CONTRIBUTING.md` — development workflow
