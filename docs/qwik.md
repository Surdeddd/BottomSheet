# Qwik

`@surdeddd/bottom-sheet/qwik` has a `<BottomSheet>` component. The markup is
rendered on the server and resumed on the client: no engine code runs until
the page is ready.

```bash
npm i @surdeddd/bottom-sheet
```

## A modal sheet

```tsx
import { component$, useSignal } from "@builder.io/qwik";
import { BottomSheet } from "@surdeddd/bottom-sheet/qwik";
import "@surdeddd/bottom-sheet/styles";

export const Filters = component$(() => {
  const open = useSignal(false);

  return (
    <>
      <button onClick$={() => (open.value = true)}>Filters</button>

      <BottomSheet
        open={open.value}
        onOpenChange$={next => (open.value = next)}
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "open", size: "fit" },
        ]}
        focusTrap
      >
        <h2 q:slot="header">Filters</h2>
        <FilterForm />
        <button q:slot="footer" onClick$={() => (open.value = false)}>
          Apply
        </button>
      </BottomSheet>
    </>
  );
});
```

`open` needs a snap point of size `0`; that point is the closed state. When
`open` starts `false` the sheet starts there, and is hidden in the server
markup. A backdrop tap, Escape, the Back button and a drag down all report
through `onOpenChange$(false)`.

## A sheet that stays on screen

There is no ref in Qwik to call methods on, so the sheet is moved with props:

```tsx
export const Nearby = component$(() => {
  const snap = useSignal("peek");

  return (
    <BottomSheet
      snap={snap.value}
      onSnap$={id => (snap.value = id)}
      snapPoints={[
        { id: "peek", size: 96 },
        { id: "half", size: "45dvh" },
        { id: "full", size: "90%" },
      ]}
    >
      <h2 q:slot="header">Nearby</h2>
      <button onClick$={() => (snap.value = "full")}>Show all</button>
    </BottomSheet>
  );
});
```

`snap` is the point the sheet rests at: change it and the sheet goes there.
Write `onSnap$` back into the signal, as above. Otherwise the signal keeps its
old value after the user drags the sheet, and setting that value again changes
nothing.

## Props

Every [engine option](../README.md#options) that can be serialised is a prop.
That leaves out the three that hold functions or live objects: `easing`,
`linkedSheets` and `features`. The component adds:

| Prop | Default | What it does |
| --- | --- | --- |
| `open`, `onOpenChange$` | uncontrolled | Controlled open state |
| `snap` | uncontrolled | The active snap point |
| `backdrop` | `true` | Render the backdrop |
| `closeOnBackdrop` | `true` | A tap on the backdrop closes the sheet |
| `teleportTo` | none | Element, selector or `"body"` to move the sheet's DOM to. `teleport={false}` switches it off |
| `ariaLabel` | `"Bottom sheet"` | Accessible name |
| `handleLabel`, `contentLabel` | English | Accessible names of the handle and the scroll area |

### Slots

| Slot | What goes in it |
| --- | --- |
| default | The scroll area |
| `header`, `footer` | Regions above and below the scroll area. An empty one is hidden |
| `leftButton`, `rightButton` | Buttons that float above the sheet's leading edge |
| `screen` | Content of the scrim layer; fades in with `progress` |

### Callbacks

| Prop | Receives | When |
| --- | --- | --- |
| `onSnap$` | `id` | The sheet settled on a point |
| `onOpen$`, `onOpened$` | `id` | It starts to appear; it has landed |
| `onClose$`, `onClosed$` | nothing | It starts to leave; it is gone |
| `onDragStart$`, `onDragEnd$` | `{ size }`, `{ size, velocity }` | A drag begins and ends |
| `onChange$` | `EngineState` | After a snap, and when a drag starts or ends |

Two kinds of callback are missing on purpose. A `$` callback is loaded and
called asynchronously, so it cannot veto a move: there is no `onBeforeSnap$`
or `onBeforeClose$`. Use `persistent`, `disableClose` or `allowed` to keep a
sheet where it is. And it cannot run on every frame: there is no `onDrag$` or
`onProgress$`. Follow the sheet in CSS with `--bs-progress` and `--bs-size`.

### Props you can change after mount

`open`, `snap`, `snapPoints`, `allowed`, `mode`, `radius`, `maxHeight`,
`persistent`, `disableClose`, `disableDrag`, `dragFrom` and `dragFromContent`
are applied to the running sheet. The rest are read once.

## Server rendering

The package has a `qwik` field that points at a build made for the Qwik
optimizer. Qwik City picks it up as a vendor root, splits it into lazy chunks
and renders a resumable sheet. No configuration is needed.

The engine attaches in a `useVisibleTask$` with the `document-ready` strategy,
so the sheet is live as soon as the page is, not when it scrolls into view.

## Things to know

- **Do not set `z-index` on `.bs-sheet`, `.bs-backdrop` or anchors.** The
  engine writes it on every change of the stack. See
  [Theming → stacking](theming.md#stacking).
- **Anchors and scrim stages** need the engine, which this adapter does not
  hand out. For those, use the [custom element](web-component.md) inside a
  Qwik component.
