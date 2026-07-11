# Migration plan: 1.0 → 2.0 (draft)

> **Status:** the package is currently **0.x** (see `version` in
> `package.json`). Neither v1.0 nor v2.0 has shipped. This document is the
> **draft plan** for the deprecations the 1.0 line is expected to carry and the
> breaking changes slated for the eventual 2.0. Nothing here has a release
> date, and the "1.x" labels below describe the *planned* 1.0 stable line — not
> a released version.

## Status legend

- ⚠️ **Planned deprecation (1.0 line)** — will carry a TS `@deprecated`
  strikethrough once tagged; keeps working at runtime
- 🔥 **Planned removal (2.0)** — slated for removal; the replacement already
  exists today

## Public API curation

### `OverlayEngine` no longer barrel-exported

⚠️ Planned deprecation (1.0) · 🔥 Planned removal (2.0)

```ts
// Today (still exported; slated for deprecation):
import { OverlayEngine, Overlay, createOverlay } from "@surdeddd/bottom-sheet";

// Recommended (works now, and after 2.0):
import { OverlayEngine, Overlay, createOverlay } from "@surdeddd/bottom-sheet/overlay";
```

The same change applies to `OverlayOptions`, `OverlayState`, `OverlayEdge`,
`OverlayEventMap` types.

**Why:** the barrel pulls `OverlayEngine` (~4 KB gzip) into bundles that
don't need it. Bundlers with imperfect tree-shaking (older Webpack, esbuild
without sideEffects-array support) keep the dead code. The subpath import
is bundle-size-safe.

### `attachGestures` renamed to `installGestures`

⚠️ Planned deprecation (1.0) · 🔥 Planned removal (2.0)

```ts
// Today (still exported; slated for deprecation):
import { attachGestures } from "@surdeddd/bottom-sheet";

// Recommended (works now, and after 2.0):
import { installGestures } from "@surdeddd/bottom-sheet";
```

**Why:** naming consistency with the other `installX` feature factories
(`installPersist`, `installRoute`, `installAutoCollapse`,
`installResizeObserver`, `installSliderKeyboard`, etc.).

### Internal helpers will be moved off the public surface

🔥 Planned removal (2.0)

The following are exported from the barrel for legacy compatibility but
are marked `@internal`. The 2.0 plan removes them entirely:

- `tween`, `easeOutBack`, `easeOutCubic`, `prefersReducedMotion`
- `runSpring`, `DEFAULT_SPRING`
- `findNearest`, `findById`, `allowedRange`
- `attachGestures` (use `installGestures`)

Consumers using any of these are doing engine-internal work and should
either:

1. Switch to the public engine API (`engine.snapTo`, `engine.on`,
   `engine.state`) for state observation, or
2. Inline the helper themselves (most are <10 lines), or
3. File an issue describing the use case so we can promote a curated
   replacement to the public surface.

`prefersReducedMotion()` specifically: replace with the one-liner
`window.matchMedia("(prefers-reduced-motion: reduce)").matches` directly.
The engine no longer uses the helper internally — it subscribes to the
media query via a live listener.

## React adapter

### `engine` field on `useBottomSheet` return value

⚠️ Planned deprecation (1.0) · 🔥 Planned removal (2.0)

```ts
// Today (still exported; slated for deprecation):
const sheet = useBottomSheet({ snapPoints });
sheet.engine?.snapTo("full");

// Recommended (works now, and after 2.0):
const sheet = useBottomSheet({ snapPoints });
sheet.getEngine()?.snapTo("full");
```

**Why:** under React Strict Mode the layout effect double-invokes — the
effect tears down (`engineRef.current = null`), the next render reads the
bare `engine` field as `null` for one frame, and only the second mount
restores a live engine. Consumers calling methods through this field
during that window get `null`. `getEngine()` reads the live ref at call
time and is Strict-Mode-safe across all render-phase races, plus
resize/setSnapPoints paths that don't fire React-tracked events.

## Files that may move (no API change)

The following files use camelCase but everything else under `src/core/` is
kebab-case. If/when v2 standardises naming, these files would rename
without API changes:

- `src/core/focusTrap.ts` → `src/core/focus-trap.ts`
- `src/core/scrollLock.ts` → `src/core/scroll-lock.ts`
- `src/core/sheetStack.ts` → `src/core/sheet-stack.ts`
- `src/core/sheetManager.ts` → `src/core/sheet-manager.ts`
- `src/core/cssLength.ts` → `src/core/css-length.ts`
- `src/core/snapPoints.ts` → `src/core/snap-points.ts`

Consumers importing through the public package don't see file paths — only
internal contributors and tooling that hard-codes paths would notice. v2
may or may not do this.

`BottomSheetEngine.ts` stays as-is: file name matches the exported class,
which is the standard exception.

## Things that are NOT changing in v2

Listed for clarity:

- The engine's public method shape (`snapTo`, `dragTo`, `open`, `close`,
  `setAllowed`, `setSnapPoints`, `on`, `use`, `destroy`, `state` getter)
- `EngineOptions` field names (additions allowed; renames are out)
- The plugin contract (`engine.use(plugin)`)
- The event map (`SheetEventMap`)
- All adapter return shapes — `useBottomSheet`'s return object loses the
  deprecated `engine` field but everything else stays
- Subpath exports for adapters (`/react`, `/vue`, etc.)
- The Custom Element's HTML attribute names (`snap-points`, `mode`,
  `allowed`, etc.) and dispatched events (`snap`, `open`, `close`,
  `progress`)

## Behaviour clarifications (NOT breaking)

The following are NOT API changes — they document existing semantics that
were either implicit before or relaxed in 1.x patch releases. Listed here
so you know what to expect without reading the source.

### `Plugin.install` is transactional via the optional `scope` arg

Plugins can register partial cleanups before risky steps. Engine drains
the scope on install failure, so a `plugin.install` that throws midway
no longer leaks listeners. Old plugins (no `scope` arg) keep working
unchanged.

```ts
const myPlugin: Plugin = {
  name: "analytics",
  install: (engine, scope) => {
    const off = engine.on("snap", trackSnap);
    scope.add(off);                    // cleaned up on install throw
    riskyFeatureProbe();               // if this throws, off() runs
    return () => trackPluginDestroyed(); // also runs on destroy()
  },
};
```

`TeardownScope` is exported from the public surface for plugin authors.

### `"drag"` event payload is reused across emissions

The `{size, delta}` payload object emitted on every `onMove` is the SAME
object identity across frames — engine mutates it instead of allocating
per frame. Consumers must NOT retain the reference (e.g. push to array
without cloning), same as you'd never retain a browser `PointerEvent`.

```ts
// ❌ Wrong — captures a moving target. All entries hold the same object.
const samples: { size: number; delta: number }[] = [];
engine.on("drag", payload => samples.push(payload));

// ✓ Right — clone what you need.
engine.on("drag", payload => samples.push({ ...payload }));
```

This was always the intended contract; explicit JSDoc was added in 1.x.

### `OverlayEngine.destroy()` while open restores focus exactly once

`returnFocus` (or its callable form) fires once per open cycle. If you
call `close()` then `destroy()`, focus is NOT moved twice — the controller
seals after the first release. Older betas could double-fire.

### Plugin install errors don't crash the engine

If `plugin.install()` throws, the engine catches it, drains any partial
`scope.add` cleanups (LIFO), and rethrows the error via
`queueMicrotask` so dev tools surface it on the next tick. Sibling
plugins still install. The engine remains usable.

## Planned 1.0 stable contract (draft)

The following surface is the one the 1.0 release is expected to **freeze** —
once 1.0 ships, additions are allowed but no rename, removal, signature
change, or behaviour change without a 2.0 breaking-change cycle. Documented
here (ahead of 1.0) so every contributor (human + AI agent) has one canonical
reference for what the stable surface will be.

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
  - **Scrim**: `setScrimMode`, `setScrimEnabled`, `setScrimTapToClose`, `setScrimColor`, `setScrimBlur`, `setScrimInteractive`, `setBackdropRange`, `setScreenRange`, `setScrim`, `setScrimOverlay`, `getScrimState`
- Public getters: `state` (returns `EngineState` snapshot)

### Overlay (`@surdeddd/bottom-sheet/overlay` subpath)

- `class OverlayEngine` — constructor `new OverlayEngine(opts: OverlayOptions)`
- Public methods: `open`, `close`, `toggle`, `destroy`, `on`
- **Setters**: `setBackdropOpacity`, `setBackdropFilter`, `setSwipeToClose`, `setEnterAnimation`, `setExitAnimation`, `setReturnFocus`, `setOverlay`, `setOverlayChildren`, `clearOverlayChildren`
- **Presets**: `OVERLAY_PRESETS` const (`'sheet' | 'dialog' | 'sidebar' | 'toast'`)

### Types pinned for v1

`SnapPoint`, `SnapPointDef`, `SnapId<T>`, `SheetMode`, `SheetEventMap`,
`EngineOptions`, `EngineState`, `Plugin`, `ScrimPreset`, `ScrimUpdate`,
`ScrimOverlayOptions`, `ScrimOverlayPosition`, `OverlayPreset`,
`OverlayUpdate`, `OverlayAnimation`, `OverlayCloseReason`,
`SwipeToCloseConfig`, `OverlayMountTarget`.

### Adapter pin

- `useBottomSheet` (React/Vue/Svelte/Solid/Qwik) — return shape stable.
  Hooks accept `onSnap?: (id) => void` callback consistently.
- `BottomSheet` component (React) — props pinned.
- Custom Element `<bottom-sheet>` (the `defineBottomSheet()` default tag) — attribute names + dispatched events stable.

### Internal — NOT pinned (subject to refactor without notice)

Anything under `src/core/controllers/`, `src/core/primitives/` (other than
public type re-exports), `src/core/features/`, the engine's private
fields, ScrimController class shape, AnimationRunner / LifecycleController
(post-extraction). Tests reading internals via `as unknown as` casts may
break on refactor — use the public introspection APIs (`engine.state`,
`engine.getScrimState()`, etc.) when possible.

## Bumping ahead of v2

There's no need to migrate everything immediately. The TypeScript
`@deprecated` tag surfaces in editor intellisense as a strikethrough; CI
linters can treat it as a warning or error per project preference. Run
`tsc` with `--strict` and a TS-deprecation rule (e.g.
`@typescript-eslint/no-deprecated`) to find every call site.

Migration scripts for the rename:

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

## Reporting issues

If you discover a v1 → v2 migration path that isn't covered here, please
file an issue. We'll add the migration step to this document and ensure
the deprecation marker is in place across the affected symbol.
