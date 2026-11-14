# Coming from another library

How the APIs of `vaul` and `react-modal-sheet` map onto this one, and what
you gain and give up by moving.

## From vaul

| vaul | Here | Notes |
| --- | --- | --- |
| `<Drawer.Root open onOpenChange>` | `<BottomSheet open onOpenChange>` | The same two props |
| `<Drawer.Trigger>` | Your own button that sets `open` | No compound components |
| `<Drawer.Portal>` | `teleportTo="body"` | Optional; the sheet is `position: fixed` either way |
| `<Drawer.Overlay>` | Built in | `backdrop={false}` removes it |
| `<Drawer.Content>` | The children | |
| `<Drawer.Title>` | `header={<h2>…</h2>}` and `ariaLabelledBy` | |
| `snapPoints={[0.4, 0.8]}` | `snapPoints={[{ id: "half", size: "40%" }, { id: "full", size: "80%" }]}` | Points have ids, and take any CSS length |
| `activeSnapPoint`, `setActiveSnapPoint` | `ref.current.state.activeId`, `ref.current.snapTo(id)`, `onSnap` | |
| `dismissible={false}` | `persistent` | The user cannot close it; your code can |
| `modal={false}` | Leave `focusTrap` and `inertSiblings` off | They are off by default |
| `direction` | `mode` | Also `start` and `end` for RTL |
| `<Drawer.NestedRoot>` | Nothing: mount another sheet | Sheets stack on their own |
| `shouldScaleBackground` | `stackEffect` scales the sheets underneath | The page itself is not scaled |
| `handleOnly` | `dragFrom="handle"` | This is the default |
| `repositionInputs` | Built in | The sheet rests on top of the on-screen keyboard |
| `container` | `teleportTo` | |

Before:

```tsx
import { Drawer } from "vaul";

<Drawer.Root open={open} onOpenChange={setOpen}>
  <Drawer.Trigger>Open</Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay />
    <Drawer.Content>
      <Drawer.Title>Settings</Drawer.Title>
      <Settings />
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>;
```

After:

```tsx
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

<>
  <button onClick={() => setOpen(true)}>Open</button>
  <BottomSheet
    open={open}
    onOpenChange={setOpen}
    snapPoints={[
      { id: "closed", size: 0 },
      { id: "open", size: "fit" },
    ]}
    focusTrap
    header={<h2>Settings</h2>}
  >
    <Settings />
  </BottomSheet>
</>;
```

## From react-modal-sheet

| react-modal-sheet | Here | Notes |
| --- | --- | --- |
| `<Sheet isOpen onClose>` | `<BottomSheet open onOpenChange>` | |
| `<Sheet.Container>`, `<Sheet.Content>` | The component and its children | |
| `<Sheet.Header>` | `header` | The handle is built in; `header` is the region under it |
| `<Sheet.Backdrop>` | Built in | `backdrop={false}` removes it |
| `snapPoints={[0, 0.5, 1]}`, `initialSnap` | `snapPoints` with ids, `initial` | Points are named, not indexed |
| `detent="content"` | A point of size `"fit"` | |
| `disableDrag` | `disableDrag` | |
| `disableDismiss` | `persistent` | |
| `onSnap` | `onSnap` | Receives the id, not an index |
| `onOpenStart`, `onOpenEnd`, `onCloseStart`, `onCloseEnd` | `onOpen`, `onOpened`, `onClose`, `onClosed` | |
| `tweenConfig` | `animation="tween"` with `duration` and `easing` | The default here is a spring |
| `avoidKeyboard` | Built in | |
| `mountPoint` | `teleportTo` | |
| `prefersReducedMotion` | `respectReducedMotion` | On by default; follows the system setting |
| `sheetRef.current.snapTo(i)` | `ref.current.snapTo(id)` | |

## What you gain

- One engine outside React as well: the same component for Vue, Svelte,
  Solid, Qwik and Preact, and a custom element for everything else.
- Snap points with names, in any CSS unit, including `fit` for the content's
  own height, and an allow-list that changes at run time.
- Sheets on the top, left and right (react-modal-sheet is bottom only), and
  logical `start` and `end` edges that follow the writing direction.
- The Back button closing the sheet, and a sheet tied to a URL.
- A keyboard slider on the handle: arrows, Home and End resize the sheet.
- No runtime dependencies. vaul builds on Radix Dialog and react-modal-sheet
  on Motion; this package ships its own gesture and spring code.

## What you give up

- **Compound components.** There is one component with props and slots. It is
  less to write and less to rearrange: you cannot put the overlay and the
  content in different places in the tree.
- **Scaling the page.** vaul's `shouldScaleBackground` and react-modal-sheet's
  `modalEffectRootId` shrink the page behind the sheet. Here `stackEffect`
  does that for sheets under sheets, not for the page; you can drive a
  transform on the page from the `progress` event.
- **Animation library hooks.** There are no Motion values to subscribe to and
  no `motion.div` props to pass through. There is the spring configuration,
  the `progress` event and the `--bs-progress` custom property.
- **Radix semantics.** vaul inherits Radix Dialog's focus management and
  `asChild` composition. The focus trap here is its own, and is off until you
  ask for it with `focusTrap`.

## See also

- [Options, methods and events](../README.md#api)
- [React guide](react.md)
- [Recipes](recipes/README.md)
