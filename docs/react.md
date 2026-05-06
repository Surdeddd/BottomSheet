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
| `closeOnBackdrop` | `true` | Tap-out closes |
| `header` | — | Drag handle content (ReactNode) |
| `leftButton` / `rightButton` | — | Slots above the sheet |
| `screen` | — | Background fading by progress |
| `noSSR` | `false` | Skip render on server (Next.js) |
| `ariaLabel` / `ariaLabelledBy` | — | Accessible name |
| `onChange(state)` | — | Fires on settled snap transitions |

### Imperative handle (`ref`)

```ts
type BottomSheetHandle = {
  snapTo(id: string): Promise<void>;
  open(id?: string): Promise<void>;
  close(): Promise<void>;
  setAllowed(ids: string[], snap?: string): void;
  state: EngineState;        // settled-only snapshot
};
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
