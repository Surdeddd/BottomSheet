# Solid

`@surdeddd/bottom-sheet/solid` has a `<BottomSheet>` component. The engine's
state goes through one signal, so a snap patches the attributes that changed
and nothing else.

```bash
npm i @surdeddd/bottom-sheet
```

## A modal sheet

```tsx
import { createSignal } from "solid-js";
import { BottomSheet } from "@surdeddd/bottom-sheet/solid";
import "@surdeddd/bottom-sheet/styles";

export function Filters() {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Filters</button>

      <BottomSheet
        open={open()}
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

## A sheet that stays on screen

```tsx
import type { BottomSheetEngine } from "@surdeddd/bottom-sheet";

let sheet: BottomSheetEngine | null = null;

<BottomSheet
  engineRef={engine => (sheet = engine)}
  snapPoints={[
    { id: "peek", size: 96 },
    { id: "half", size: "45dvh" },
    { id: "full", size: "90%" },
  ]}
  initial="peek"
  header={<h2>Nearby</h2>}
  onSnap={id => console.log("rests at", id)}
>
  <PlaceList onPick={() => sheet?.snapTo("full")} />
</BottomSheet>;
```

`engineRef` receives the engine when the sheet mounts and `null` when it
unmounts. Every [method](../README.md#methods) is on it.

## Props

Every [engine option](../README.md#options) is a prop. The component adds:

| Prop | Default | What it does |
| --- | --- | --- |
| `open`, `onOpenChange` | uncontrolled | Controlled open state |
| `engineRef` | none | Receives the engine, then `null` |
| `header`, `footer` | none | Regions above and below the scroll area |
| `leftButton`, `rightButton` | none | Buttons that float above the sheet's leading edge |
| `screen` | none | Content of the scrim layer; fades in with `progress` |
| `backdrop` | `true` | Render the backdrop |
| `closeOnBackdrop` | `true` | A tap on the backdrop closes the sheet |
| `teleportTo` | none | Element, selector or `"body"` to move the sheet's DOM to. `teleport={false}` switches it off |
| `ariaLabel` | `"Bottom sheet"` | Accessible name |
| `handleLabel`, `contentLabel` | English | Accessible names of the handle and the scroll area |

### Callbacks

| Prop | Receives | When |
| --- | --- | --- |
| `onSnap` | `id` | The sheet settled on a point |
| `onOpen`, `onOpened` | `id` | It starts to appear; it has landed |
| `onClose`, `onClosed` | nothing | It starts to leave; it is gone |
| `onBeforeSnap` | `{ id, size, previousId, cancel }` | Before a move. `cancel()` stops it |
| `onBeforeClose` | `{ reason, cancel }` | Before a close. `reason` is `programmatic`, `backdrop`, `escape` or `back` |
| `onDragStart`, `onDragEnd` | `{ size }`, `{ size, velocity }` | A drag begins and ends |
| `onDrag`, `onProgress` | `{ size, delta }`, `{ value, size }` | Every frame of a drag; every frame of any motion |
| `onChange` | `EngineState` | After a snap, and when a drag starts or ends |

`cancel()` must be called synchronously, inside the callback. `onDrag` and
`onProgress` are subscribed only if they are present when the component
mounts; write to the DOM from them, not to a signal.

### Props you can change after mount

`open`, `snapPoints`, `allowed`, `mode`, `radius`, `maxHeight`, `persistent`,
`disableClose`, `disableDrag`, `dragFrom` and `dragFromContent` follow their
signals. For the rest, either call the engine (`sheet.setBackdropColor(…)`) or
remount the component inside a `<Show>`.

## Server rendering

The adapter can be imported and rendered on the server; the engine attaches in
`onMount`. A sheet that starts closed is rendered with
`data-bs-rest="closed"`, which hides it until then.

The package has a `solid` export condition that points at the JSX source, so
SolidStart compiles the component with your own Solid toolchain, for both the
server and the client.

## Things to know

- **Do not set `z-index` on `.bs-sheet`, `.bs-backdrop` or anchors.** The
  engine writes it on every change of the stack. See
  [Theming → stacking](theming.md#stacking).
- **Anchors and scrim stages** have no props on this component. Add them
  through the engine: `sheet.addAnchor()` and `sheet.setScrimStages()`; see
  [Anchors and scrim stages](anchors.md).
