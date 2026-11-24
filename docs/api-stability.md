# API stability

The package is at 0.x. Under semver that means a minor release may change
behaviour, and several have. This page says what is meant to stay put, what
1.0 will freeze, and what changed on the way.

## What you can rely on today

Nothing in this list has been renamed or removed since 0.14, and nothing in
it will be before 1.0:

- The names of the engine's methods: `snapTo`, `open`, `close`, `expand`,
  `collapse`, `setAllowed`, `setSnapPoints`, `on`, `use`, `destroy`, and the
  `state` getter.
- The names of the options. Options are added; none is renamed.
- The event names and the shape of their payloads.
- The entry points: `/react`, `/vue`, `/svelte`, `/solid`, `/qwik`, `/preact`,
  `/element`, `/overlay`, `/core`, `/features`, `/webgl`, `/debug`, `/styles`.
- The custom element's attribute names and event names.
- The `--bs-*` custom properties and the `.bs-*` class names.

One exception: `/webgl` is [experimental](webgl.md#known-issues). Its options
and behaviour may change in any release, and it may be removed before 1.0.

What 0.x releases do change is behaviour at the edges: what a method does on
a sheet that is already there, which gestures an option blocks, when an event
fires. Each such change is listed in the [changelog](../CHANGELOG.md) under
"Changed", with the old behaviour and the way to keep it.

## The road to 1.0

1.0 is a promise that the list above, and the behaviour behind it, changes
only with a major version. Two things stand between 0.25 and that promise:

1. **Field time for 0.24 and 0.25.** 0.24 changed when lifecycle events fire,
   what `persistent` blocks and how the backdrop options work; 0.25 answered
   the design questions below. Both need a release cycle in real apps before
   they are frozen.
2. **A real-device pass for the on-screen keyboard.** Resting on the keyboard
   is tested against an emulated `visualViewport`. iOS Safari and Android
   Chrome each need a manual pass, and the result recorded here.

Answered in 0.25, because the answers would have been breaking after 1.0:

- **What a move's promise says.** `snapTo()`, `open()`, `close()`, `expand()`
  and `collapse()` resolve with `"landed"`, `"vetoed"` or `"replaced"`.
- **What a percentage is a percentage of.** The window, unless
  `bounds: "container"` says the sheet's nearest positioned ancestor.
- **The role of a sheet that is not modal.** A `region` in every adapter; a
  `dialog` with `aria-modal` only with `focusTrap`.
- **What a screen reader hears for a snap point.** Its `label`, or its `id`.

Not planned for 1.0:

- an Angular package (the [recipe](angular.md) and the custom element cover
  it), compound components, and scaling the page behind the sheet;
- **anchors and scrim stages as a separate feature.** They live in the engine
  class, so the slim core carries them. Moving them out would make
  `addAnchor()`, `setScrimStages()` and `setScrimOverlay()` something a feature
  adds, on the engine and on every adapter's handle, and those methods are in
  the list above. The saving goes to `/core` users only;
- **anchors in Qwik.** An anchor is an element the engine moves into its own
  wrapper, and Qwik projects a slot back to where the component rendered it
  on every render. It needs an anchor the engine positions in place, which is
  an addition and can come after 1.0.

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

## What 1.0 freezes

Once frozen, these take additions but no rename, removal, signature change or
behaviour change without a major version.

### Engine

- `new BottomSheetEngine(options)` and `new BottomSheetCore(options)`
- Moving: `snapTo(id, { velocity?, signal? })`, `open(id?)`, `close(reason?)`,
  `expand()`, `collapse()`, each resolving with `"landed"`, `"vetoed"` or
  `"replaced"`, and `dragTo(size, { velocity?, signal? })`
- Points: `setSnapPoints(points, allowed?)`, `setAllowed(ids, snap?)`,
  `getAllowedIds()`, `getResolvedSnaps()`, `recompute()`
- Behaviour: `setMode()`, `getMode()`, `setPersistent()`, `setDisableClose()`,
  `setDisableDrag()`, `setDragFrom()`, `getDragFrom()`,
  `setDragFromContent()`, `setRadius()`, `setMaxHeight()`,
  `setLinkedSheets()`
- Dim layers: `setBackdropRange()`, `setBackdropOpacity()`,
  `setBackdropColor()`, `setScreenRange()`, `setScrim()`, `setScrimMode()`,
  `setScrimEnabled()`, `setScrimTapToClose()`, `setScrimColor()`,
  `setScrimBlur()`, `setScrimInteractive()`, `setScrimOverlay()`,
  `getScrimState()`
- Around the sheet: `addAnchor()`, `setScrimStages()`
- Reading: `state`, `canDismiss()`, `isTop()`, `depth()`
- `on(event, listener)`, `use(plugin)`, `destroy()`

### Overlay

- `new OverlayEngine(options)`; `open()`, `close(reason?)`, `toggle()`,
  `destroy()`, `on()`, `state`
- `setOverlay()`, `setBackdropOpacity()`, `setBackdropFilter()`,
  `setSwipeToClose()`, `setEnterAnimation()`, `setExitAnimation()`,
  `setReturnFocus()`, `setOverlayChildren()`, `clearOverlayChildren()`
- `OVERLAY_PRESETS`: `sheet`, `dialog`, `sidebar`, `toast`

### Types

`SnapPoint`, `SnapPointDef`, `SnapId`, `SheetMode`, `SheetEventMap`,
`CloseReason`, `EngineOptions`, `EngineConfig`, `EngineState`, `SheetPhase`,
`Plugin`, `EngineFeature`, `ScrimPreset`, `ScrimUpdate`,
`ScrimOverlayOptions`, `AnchorOptions`, `ScrimStagesOptions`,
`OverlayOptions`, `OverlayState`, `OverlayUpdate`.

### Adapters

- The props, slots, events and exposed methods documented in each adapter's
  guide.
- `useBottomSheet()` in React and Vue, `createBottomSheet()` in Svelte: the
  shape of what they return.
- `<bottom-sheet>`: attributes, properties, methods, events, slots and parts.

### Not frozen

Anything not exported from an entry point: the controllers, the primitives,
the features' internals and the engine's private fields. The experimental
`/webgl` entry is not frozen either. The DOM the
components render is frozen only as far as the documented class names and
`data-` attributes go.

## Reporting issues

If you hit a migration path this document doesn't cover, file an issue and the
step will be added here.
