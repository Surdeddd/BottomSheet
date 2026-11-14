# React

`@surdeddd/bottom-sheet/react` has a `<BottomSheet>` component and a
`useBottomSheet()` hook for when you want to write the markup yourself. React
18 or newer.

```bash
npm i @surdeddd/bottom-sheet
```

## A modal sheet

```tsx
import { useState } from "react";
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

export function Filters() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Filters</button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "open", size: "fit" },
        ]}
        focusTrap
        header={<h2>Filters</h2>}
        footer={<button onClick={() => setOpen(false)}>Apply</button>}
      >
        <FilterForm />
      </BottomSheet>
    </>
  );
}
```

`open` needs a snap point of size `0`; that point is the closed state. When
`open` starts `false` the sheet starts there, and is hidden in the server
markup. A backdrop tap, Escape, the Back button and a drag down all report
through `onOpenChange(false)`.

Leave `open` out and the sheet is uncontrolled: it starts at `initial` (or the
first point) and you move it through the ref.

## A sheet that stays on screen

```tsx
import { useRef } from "react";
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";

export function Nearby() {
  const sheet = useRef<BottomSheetHandle>(null);

  return (
    <BottomSheet
      ref={sheet}
      snapPoints={[
        { id: "peek", size: 96 },
        { id: "half", size: "45dvh" },
        { id: "full", size: "90%" },
      ]}
      initial="peek"
      header={<h2>Nearby</h2>}
      onSnap={id => console.log("rests at", id)}
    >
      <PlaceList onPick={() => sheet.current?.snapTo("full")} />
    </BottomSheet>
  );
}
```

## Props

Every [engine option](../README.md#options) is a prop. The component adds:

| Prop | Default | What it does |
| --- | --- | --- |
| `open`, `onOpenChange` | uncontrolled | Controlled open state |
| `header`, `footer` | none | Regions above and below the scroll area. A node, or `(state) => node` |
| `leftButton`, `rightButton` | none | Slots that float above the sheet's leading edge |
| `screen` | none | Content of the scrim layer; fades in with `progress` |
| `anchors`, `scrimStages` | none | [Anchors and scrim stages](anchors.md), declared as data with a `node` each |
| `backdrop` | `true` | Render the backdrop |
| `closeOnBackdrop` | `true` | A tap on the backdrop closes the sheet |
| `teleportTo` | none | Element, selector or `"body"` to move the sheet's DOM to, out of a clipping or transformed ancestor |
| `className`, `style` | none | Go on the sheet element (`.bs-sheet`) |
| `ariaLabel` | `"Bottom sheet"` | Accessible name. `ariaLabelledBy` points at a heading instead |
| `handleLabel`, `contentLabel` | English | Accessible names of the handle and the scroll area |
| `noSSR` | `false` | Render nothing on the server and on the first client render |

The sheet has `role="dialog"` and `aria-modal` when `focusTrap` is on, and
`role="region"` when it is not.

### Callbacks

| Prop | Receives | When |
| --- | --- | --- |
| `onSnap` | `id` | The sheet settled on a point |
| `onOpen`, `onOpened` | `id` | It starts to appear; it has landed |
| `onClose`, `onClosed` | nothing | It starts to leave; it is gone. Unmount in `onClosed` |
| `onBeforeSnap` | `{ id, size, previousId, cancel }` | Before a move. `cancel()` stops it |
| `onBeforeClose` | `{ reason, cancel }` | Before a close. `reason` is `programmatic`, `backdrop`, `escape` or `back` |
| `onDragStart`, `onDragEnd` | `{ size }`, `{ size, velocity }` | A drag begins and ends |
| `onDrag`, `onProgress` | `{ size, delta }`, `{ value, size }` | Every frame of a drag; every frame of any motion |
| `onChange` | `EngineState` | The state React sees changed: after a snap, and when a drag starts or ends |

`cancel()` must be called synchronously, inside the callback.

`onDrag` and `onProgress` are subscribed only if they are present when the
component mounts, so that a sheet without them builds no per-frame payload. Do
not call `setState` from them; write to the DOM.

### Props you can change after mount

`open`, `snapPoints`, `allowed`, `mode`, `radius`, `maxHeight`, `persistent`,
`disableClose`, `disableDrag`, `dragFrom`, `dragFromContent`, `backdropColor`
and `backdropOpacity` are applied to the running sheet. `snapPoints` is
compared by content, so an array written inline does not reset anything on
re-render.

The remaining options, such as `animation`, `focusTrap` or `closeOnBack`, are
read once. To change one of them, give the component a `key` that changes with
it.

## The ref

```ts
type BottomSheetHandle = {
  snapTo(id: string): Promise<void>;
  open(id?: string): Promise<void>;
  close(reason?: CloseReason): Promise<void>;
  expand(): Promise<void>;
  collapse(): Promise<void>;
  setAllowed(ids: string[], snap?: string): void;
  setSnapPoints(points: SnapPointDef[], allowed?: string[]): void;
  recompute(): void;
  isTop(): boolean;
  depth(): number;
  setScrim(update: ScrimUpdate): void;
  setScrimOverlay(options: ScrimOverlayOptions): () => void;
  addAnchor(options: AnchorOptions): () => void;
  setScrimStages(options: ScrimStagesOptions | null): () => void;
  on(event, listener): () => void;
  getEngine(): BottomSheetEngine | null;
  state: EngineState;
};
```

`state` on the ref is live. Everything else the engine can do, such as
`setRadius()` or `getResolvedSnaps()`, is on `getEngine()`.

`open()` and `snapTo()` are safe to call in a mount effect; no
`requestAnimationFrame` is needed.

To follow the sheet frame by frame, subscribe once and write to the DOM:

```tsx
useEffect(
  () =>
    sheet.current?.on("progress", ({ value }) => {
      mapRef.current!.style.opacity = String(1 - value);
    }),
  [],
);
```

## The hook

`useBottomSheet()` gives you the refs and the methods and leaves the markup to
you:

```tsx
import { useBottomSheet } from "@surdeddd/bottom-sheet/react";

const { sheetRef, handleRef, contentRef, backdropRef, state, snapTo } =
  useBottomSheet({ snapPoints, initial: "peek" });

return (
  <div className="bs-root">
    <div ref={backdropRef} className="bs-backdrop" />
    <section ref={sheetRef} className="bs-sheet" data-mode="bottom" aria-label="Places">
      <div ref={handleRef} className="bs-handle" role="slider" tabIndex={0} aria-label="Resize sheet" />
      <div ref={contentRef} className="bs-content">…</div>
    </section>
  </div>
);
```

`state` here is a snapshot that updates on `snap`, `dragstart` and `dragend`,
so a drag does not re-render your component on every frame. The hook follows
the same props as the component, apart from `open` and `mode`: use `open()`,
`close()` and `getEngine()?.setMode()`.

## Server rendering

The adapter can be imported and rendered in Node. The markup comes from the
server and the engine attaches during hydration. A sheet that starts closed is
rendered with `data-bs-rest="closed"`, which hides it until then.

In the Next.js App Router the component needs a client boundary:

```tsx
"use client";
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
```

`noSSR` skips the server render where you want that.

## Forms

```tsx
import { useFormGuard } from "@surdeddd/bottom-sheet/integrations/react-hook-form";

const form = useForm();
const sheet = useRef<BottomSheetHandle>(null);
useFormGuard(sheet, form);
```

The sheet stays put while the form submits and stays open while it has unsaved
changes. `useFormikGuard(sheet, formikRef)` from
`@surdeddd/bottom-sheet/integrations/formik` does the same for Formik.

## A sheet from JSON

`<BottomSheetFromConfig>` builds a sheet from a plain object, for sheets
described by a CMS or a feature flag. See the
[recipe](recipes/json-config.md).

## Things to know

- **Do not set `z-index` on `.bs-sheet`, `.bs-backdrop` or anchors.** The
  engine writes it on every change of the stack. To place the sheets against
  the rest of the app, move the `teleportTo` target or the parent of
  `.bs-root`. See [Theming → stacking](theming.md#stacking).
- **Router guards and `closeOnBack`.** The Back button entry is a same-URL
  `history.pushState` marked `__bs: true` in `history.state`. A global guard
  that asks "leave this page?" should let it through; the
  [Vue guide](vue.md#router-guards) has the pattern.
