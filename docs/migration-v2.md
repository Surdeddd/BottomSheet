# Breaking changes and the stable-surface plan

> **Status:** the package is **0.x** (see `version` in `package.json`). Neither
> 1.0 nor 2.0 has shipped, and both are still far off. Under 0.x semver, a minor
> bump may break API — so the curation once drafted for "2.0" landed in
> **0.14.0** instead, and the version line continues 0.14 → 0.15 → … This
> document records what changed and what the eventual stable surface is expected
> to freeze.

## Removed in 0.14.0

Each removal has a replacement that already existed before the change. If you
are on 0.13.x, apply these edits and nothing else changes at runtime.

### `OverlayEngine` is subpath-only

```ts
// Before (0.13):
import { OverlayEngine, Overlay, createOverlay } from "@surdeddd/bottom-sheet";

// Now:
import { OverlayEngine, Overlay, createOverlay } from "@surdeddd/bottom-sheet/overlay";
```

The same applies to `OVERLAY_PRESETS` and the `OverlayOptions`, `OverlayState`,
`OverlayEdge`, `OverlayEventMap`, `OverlayPreset`, `OverlayUpdate`,
`OverlayAnimation`, `OverlayCloseReason`, `SwipeToCloseConfig`,
`OverlayMountTarget` types.

**Why:** the barrel pulled `OverlayEngine` (~4 KB gzip) into bundles that never
used it. Bundlers with imperfect tree-shaking (older Webpack, esbuild without
sideEffects-array support) kept the dead code. The subpath import is
bundle-size-safe.

### `attachGestures` → `installGestures`

```ts
// Before (0.13):
import { attachGestures } from "@surdeddd/bottom-sheet";

// Now:
import { installGestures } from "@surdeddd/bottom-sheet";
```

Behaviour is identical — it was an alias. The name now matches the other
`installX` factories (`installPersist`, `installRoute`, `installAutoCollapse`,
`installResizeObserver`, `installSliderKeyboard`).

### Engine-internal helpers are off the public surface

No longer exported from the barrel:

- `tween`, `easeOutBack`, `easeOutCubic`, `prefersReducedMotion`
- `runSpring`, `DEFAULT_SPRING`
- `findNearest`, `findById`, `allowedRange`

They remain inside the engine — only the public export is gone. Consumers using
any of them were doing engine-internal work and should either:

1. Switch to the public engine API (`engine.snapTo`, `engine.on`,
   `engine.state`) for state observation, or
2. Inline the helper (most are under 10 lines), or
3. File an issue describing the use case, so a curated replacement can be
   promoted to the public surface.

`prefersReducedMotion()` specifically: use
`window.matchMedia("(prefers-reduced-motion: reduce)").matches`. The engine no
longer uses the helper internally — it subscribes to the media query with a live
listener.

### React: the `engine` field is gone

```ts
// Before (0.13):
const sheet = useBottomSheet({ snapPoints });
sheet.engine?.snapTo("full");

// Now:
const sheet = useBottomSheet({ snapPoints });
sheet.getEngine()?.snapTo("full");
```

**Why:** under React Strict Mode the layout effect double-invokes — teardown
sets `engineRef.current = null`, the next render read the bare `engine` field as
`null` for one frame, and only the second mount restored a live engine.
Consumers calling methods through the field during that window got `null`.
`getEngine()` reads the live ref at call time and is Strict-Mode-safe, plus it
covers the resize / `setSnapPoints` paths that fire no React-tracked event.

### Internal file renames (no API change)

`src/core/` is now uniformly kebab-case:

| Before | After |
| --- | --- |
| `lifecycle/focusTrap.ts` | `lifecycle/focus-trap.ts` |
| `lifecycle/scrollLock.ts` | `lifecycle/scroll-lock.ts` |
| `lifecycle/sheetStack.ts` | `lifecycle/sheet-stack.ts` |
| `lifecycle/sheetManager.ts` | `lifecycle/sheet-manager.ts` |
| `primitives/cssLength.ts` | `primitives/css-length.ts` |
| `primitives/devWarn.ts` | `primitives/dev-warn.ts` |

Consumers importing through the package see no file paths — only internal
contributors and tooling that hard-codes paths are affected.
`BottomSheetEngine.ts` keeps its name: the file matches the exported class,
which is the standard exception. React-style hook files (`useBottomSheet.ts`)
also stay camelCase, per the ecosystem convention.

## Migration scripts

```bash
# attachGestures → installGestures
git ls-files | grep -E '\.(ts|tsx|js|jsx)$' | xargs sed -i '' \
  's/\battachGestures\b/installGestures/g'

# OverlayEngine barrel → subpath
git ls-files | grep -E '\.(ts|tsx|js|jsx)$' | xargs sed -i '' \
  -E 's|from ["'\'']@surdeddd/bottom-sheet["'\'']|FROM_BARREL|; \
      s|FROM_BARREL.*\b(OverlayEngine\|Overlay\|createOverlay)\b|from "@surdeddd/bottom-sheet/overlay"|'

# (Review the diff manually — sed-based migrations are best-effort.)
```

Since the removed symbols no longer exist, `tsc` reports every remaining call
site as an error — the compiler is the migration checklist.

## Not changing

- The engine's public method shape (`snapTo`, `dragTo`, `open`, `close`,
  `setAllowed`, `setSnapPoints`, `on`, `use`, `destroy`, `state` getter)
- `EngineOptions` field names (additions allowed; renames are out)
- The plugin contract (`engine.use(plugin)`)
- The event map (`SheetEventMap`)
- Adapter return shapes, aside from React's removed `engine` field
- Subpath exports for adapters (`/react`, `/vue`, …)
- The Custom Element's attribute names (`snap-points`, `mode`, `allowed`, …)
  and dispatched events (`snap`, `open`, `close`, `progress`)

## Behaviour clarifications (not breaking)

These document existing semantics that were implicit before.

### `Plugin.install` is transactional via the optional `scope` arg

Plugins can register partial cleanups before risky steps. The engine drains the
scope on install failure, so a `plugin.install` that throws midway leaks no
listeners. Plugins without the `scope` arg keep working unchanged.

```ts
const myPlugin: Plugin = {
  name: "analytics",
  install: (engine, scope) => {
    const off = engine.on("snap", trackSnap);
    scope.add(off);
    riskyFeatureProbe();
    return () => trackPluginDestroyed();
  },
};
```

`TeardownScope` is exported for plugin authors.

### The `"drag"` payload is reused across emissions

The `{size, delta}` object emitted on every `onMove` is the SAME object identity
across frames — the engine mutates it instead of allocating per frame. Do not
retain the reference, the same way you would never retain a browser
`PointerEvent`.

```ts
// Wrong — every entry holds the same moving object.
const samples: { size: number; delta: number }[] = [];
engine.on("drag", payload => samples.push(payload));

// Right — clone what you need.
engine.on("drag", payload => samples.push({ ...payload }));
```

### `OverlayEngine.destroy()` while open restores focus exactly once

`returnFocus` (or its callable form) fires once per open cycle. Calling
`close()` then `destroy()` does not move focus twice — the controller seals
after the first release.

### Plugin install errors don't crash the engine

If `plugin.install()` throws, the engine catches it, drains partial `scope.add`
cleanups (LIFO), and rethrows via `queueMicrotask` so dev tools surface it on
the next tick. Sibling plugins still install; the engine stays usable.

## Planned stable contract

The surface a 1.0 release would **freeze**. Once frozen, additions are allowed
but no rename, removal, signature change, or behaviour change without a major
cycle. Documented ahead of time so every contributor has one canonical
reference.

### Engine

- `class BottomSheetEngine` — constructor `new BottomSheetEngine(opts: EngineOptions)`
- Public methods (signatures pinned):
  - `snapTo(id: string, opts?: { signal?: AbortSignal; velocity?: number }): Promise<void>`
  - `dragTo(size: number): Promise<void>`
  - `open(): Promise<void>`, `close(): Promise<void>`
  - `setAllowed(ids: string[]): void`
  - `setSnapPoints(points: SnapPointDef[], allowed?: string[]): void`
  - `setLinkedSheets(others: BottomSheetEngine[]): void`
  - `on<K extends keyof SheetEventMap>(event: K, fn): () => void`
  - `use(plugin: Plugin): this`
  - `destroy(): void`
  - `getAllowedIds(): string[]`
  - **Drag control**: `setDragFrom`, `getDragFrom`, `setDragFromContent`,
    `attachDragSurface`
  - **Scrim**: `setScrimMode`, `setScrimEnabled`, `setScrimTapToClose`,
    `setScrimColor`, `setScrimBlur`, `setScrimInteractive`, `setBackdropRange`,
    `setScreenRange`, `setScrim`, `setScrimOverlay`, `getScrimState`
- Public getters: `state` (returns an `EngineState` snapshot)

### Overlay (`@surdeddd/bottom-sheet/overlay` subpath)

- `class OverlayEngine` — constructor `new OverlayEngine(opts: OverlayOptions)`
- Public methods: `open`, `close`, `toggle`, `destroy`, `on`
- **Setters**: `setBackdropOpacity`, `setBackdropFilter`, `setSwipeToClose`,
  `setEnterAnimation`, `setExitAnimation`, `setReturnFocus`, `setOverlay`,
  `setOverlayChildren`, `clearOverlayChildren`
- **Presets**: `OVERLAY_PRESETS` (`'sheet' | 'dialog' | 'sidebar' | 'toast'`)

### Pinned types

`SnapPoint`, `SnapPointDef`, `SnapId<T>`, `SheetMode`, `SheetEventMap`,
`EngineOptions`, `EngineState`, `Plugin`, `DragFromMode`, `ScrimPreset`,
`ScrimUpdate`, `ScrimOverlayOptions`, `ScrimOverlayPosition`, `OverlayPreset`,
`OverlayUpdate`, `OverlayAnimation`, `OverlayCloseReason`,
`SwipeToCloseConfig`, `OverlayMountTarget`.

### Adapter pin

- `useBottomSheet` (React/Vue/Svelte/Solid/Qwik) — return shape stable. Hooks
  accept `onSnap?: (id) => void` consistently.
- `BottomSheet` component (React) — props pinned.
- Custom Element `<bottom-sheet>` (the `defineBottomSheet()` default tag) —
  attribute names and dispatched events stable.

### Internal — not pinned

Anything under `src/core/controllers/`, `src/core/primitives/` (other than
public type re-exports), `src/core/features/`, the engine's private fields, the
ScrimController shape, AnimationRunner / LifecycleController. Tests reading
internals through `as unknown as` casts may break on refactor — prefer the
public introspection APIs (`engine.state`, `engine.getScrimState()`).

## Reporting issues

If you hit a migration path this document doesn't cover, file an issue and the
step will be added here.
