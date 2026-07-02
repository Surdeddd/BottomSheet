# @surdeddd/bottom-sheet · React

React 17+ adapter. Ships a `<BottomSheet>` component (forwardRef) and a
`useBottomSheet()` hook for headless control.

## Install

```bash
npm i @surdeddd/bottom-sheet react react-dom
```

## Component API

```tsx
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";
import { useRef } from "react";

export const App = () => {
  const ref = useRef<BottomSheetHandle>(null);

  return (
    <BottomSheet
      ref={ref}
      snapPoints={[
        { id: "minimized", size: 96 },
        { id: "half",      size: "45dvh" },
        { id: "full",      size: "85%" },
      ]}
      initial="minimized"
      animation="spring"
      spring={{ stiffness: 260, damping: 28 }}
      focusTrap
      closeOnEscape
      closeOnBack                 // Android hardware back
      backdropRange={[0.4, 1]}    // backdrop fades in only past 40% progress
      header={<h2>Search</h2>}
      leftButton={<BackButton />}
      rightButton={<MoreButton />}
      screen={<MapPreview />}     // fades in behind the sheet by progress
      onChange={(state) => console.log(state.activeId, state.progress)}
    >
      <YourScrollableContent />
    </BottomSheet>
  );
};
```

### Props

Every `EngineOption` is forwarded plus:

| Prop | Default | Description |
| --- | --- | --- |
| `backdrop` | `true` | Render the dimmed overlay element |
| `closeOnBackdrop` | `true` | Tap-out closes (only when `canDismiss()`) |
| `header` | — | Header content — `ReactNode` or `(state) => ReactNode` |
| `footer` | — | Footer content, pinned below the scroll area — same signature as `header` |
| `leftButton` / `rightButton` | — | Slots above the sheet |
| `screen` | — | Background fading by progress |
| `teleportTo` | — | Relocate the sheet DOM (`HTMLElement`, selector, or `"body"`) to escape a transformed/clipping ancestor |
| `backdropColor` | — | Scrim color, applied via `setScrimColor` (no `--bs-backdrop-color` needed) |
| `backdropOpacity` | — | Max backdrop opacity, applied via `setBackdropRange([0, opacity])` |
| `noSSR` | `false` | Skip render on server (Next.js) |
| `ariaLabel` / `ariaLabelledBy` | — | Accessible name |

### Event callbacks

| Prop | Payload | Fires |
| --- | --- | --- |
| `onChange(state)` | `EngineState` | On settled snap transitions |
| `onSnap(id)` | `string` | Settled on a new snap |
| `onBeforeSnap(e)` | `{ id, size, previousId, cancel }` | Before a snap settles — call `e.cancel()` **synchronously** to veto |
| `onBeforeClose(e)` | `{ reason, cancel }` | Before a dismissal — call `e.cancel()` synchronously to veto |
| `onOpen(id)` | `string` | Enter starts (0 → >0) |
| `onOpened(id)` | `string` | Enter settled |
| `onClose()` | — | Exit starts |
| `onClosed()` | — | Exit settled |
| `onDragStart(e)` | `{ size }` | Pointer drag begins |
| `onDragEnd(e)` | `{ size, velocity }` | Pointer drag ends |
| `onDrag(e)` | `{ size, delta }` | ~60 fps during drag — **provide at mount** (see below) |
| `onProgress(e)` | `{ value, size }` | ~60 fps during motion — **provide at mount** (see below) |

`onDrag` / `onProgress` are hot-path: the hook only subscribes to the engine's
`drag` / `progress` streams when the handler is present **at mount**. Adding
these props after mount has no effect (and the engine builds no per-frame
payload at all when no handler is attached). Keep the handler stable and don't
call `setState` from it — mutate the DOM directly.

### Imperative handle (`ref`)

```ts
type BottomSheetHandle = {
  snapTo(id: string): Promise<void>;
  open(id?: string): Promise<void>;
  close(reason?: CloseReason): Promise<void>;
  expand(): Promise<void>;    // largest allowed snap
  collapse(): Promise<void>;  // smallest allowed snap > 0
  isTop(): boolean;           // top of the multi-sheet stack?
  depth(): number;            // open sheets above this one
  setAllowed(ids: string[], snap?: string): void;
  setSnapPoints(points: EngineOptions["snapPoints"], allowed?: string[]): void;
  setScrim(opts: ScrimUpdate): void;
  setScrimOverlay(opts: ScrimOverlayOptions): () => void;
  addAnchor(opts: AnchorOptions): () => void;
  setScrimStages(opts: ScrimStagesOptions | null): () => void;
  recompute(): void;          // re-measure a 'fit' / 'content' snap
  getEngine(): BottomSheetEngine | null;
  state: EngineState;        // settled-only snapshot
};
```

Runtime setters that aren't on the handle — `setPersistent`, `setDisableClose`,
`setDisableDrag`, `setRadius`, `setMaxHeight`, `getResolvedSnaps` — are reached
via `getEngine()`. The `persistent` / `disableClose` / `disableDrag` / `radius`
/ `maxHeight` props are also **reactive**: changing them after mount applies to
the live engine without a remount.

### Anchors & scrim stages (declarative)

```tsx
<BottomSheet
  anchors={[
    { position: "sheet-top-right", showOn: ["half", "full"], animation: "pop",
      node: <CloseButton /> },
    { position: "dock-bottom", node: <TabBar /> },
  ]}
  scrimStages={{
    stages: [
      { for: "peek", node: <Teaser /> },
      { forRange: [0.5, 1], node: <Expanded /> },
    ],
  }}
  ...
/>
```

See [anchors & stages docs](anchors.md) for positions, `showOn`, `fadeRange`
and the animation spec.

```ts
```

## Headless hook

For full JSX control, use `useBottomSheet()`:

```tsx
import { useBottomSheet } from "@surdeddd/bottom-sheet/react";

const { sheetRef, handleRef, contentRef, backdropRef, screenRef, state, snapTo } =
  useBottomSheet({ snapPoints, animation: "spring" });

return (
  <div className="bs-root">
    <div ref={backdropRef} className="bs-backdrop" />
    <section ref={sheetRef} className="bs-sheet" data-mode="bottom">
      <div ref={handleRef} className="bs-handle">…</div>
      <div ref={contentRef} className="bs-content">…</div>
    </section>
  </div>
);
```

## SSR / Next.js

The component is SSR-safe by default (no `window` touched at import). For
hydration-strict pages, pass `noSSR`:

```tsx
<BottomSheet noSSR snapPoints={…}>…</BottomSheet>
```

Or wrap with `dynamic`:

```tsx
const BottomSheet = dynamic(
  () => import("@surdeddd/bottom-sheet/react").then(m => m.BottomSheet),
  { ssr: false },
);
```

## One-shot construction

`useBottomSheet(opts)` reads `opts` once on mount and never re-watches it.
Mutating `opts.snapPoints` / `opts.allowed` / `opts.mode` between renders has
**no effect** on the engine — this matches React's "uncontrolled state owned
by an effect" pattern and avoids whole-engine remount thrash on every render.

For runtime updates, use the returned setter methods:

```tsx
const sheet = useBottomSheet({ snapPoints, allowed, initial: "min" });

// Replace allow-list at runtime (e.g. lock to "full" while a form is dirty):
useEffect(() => {
  sheet.setAllowed(formDirty ? ["full"] : ["min", "full"]);
}, [formDirty, sheet]);

// Replace snap-point geometry (respond to viewport changes):
sheet.getEngine()?.setSnapPoints(newSnapPoints);
```

Engine recreation (changing `mode`, `animation`, `focusTrap`) requires a
keyed remount — wrap the component in a parent with a `key` that flips
when those config props change.

> Use `getEngine()` rather than the deprecated `engine` field on the return
> value: under React Strict Mode the layout effect double-invokes and the
> bare `engine` field is briefly `null` for one render between teardown and
> remount.

## Performance

The hook subscribes to `useSyncExternalStore` only on `snap` / `dragstart` /
`dragend` — drag pixels and animation frames don't trigger React renders. For
continuous progress in your UI, subscribe imperatively:

```tsx
const ref = useRef<BottomSheetHandle>(null);

useEffect(() => {
  const id = setInterval(() => {
    if (ref.current) updateMyDOM(ref.current.state.progress);
  }, 33);
  return () => clearInterval(id);
}, []);
```
