# Migration guide

Switching from `vaul` or `react-modal-sheet` to `@surdeddd/bottom-sheet`. Concrete API mappings + code diffs + an honest rundown of what you gain and lose.

## From `vaul`

`vaul` is React-only, popular for its iOS-feel drag and Radix-style composition.

### Prop mapping

| `vaul` | `@surdeddd/bottom-sheet` | Notes |
| --- | --- | --- |
| `<Drawer.Root open={...}>` | `<BottomSheet>` (controlled via `ref.snapTo`) | We use refs + snap ids, not boolean open |
| `snapPoints={[0.4, 0.8]}` (decimals 0-1) | `snapPoints={[{id:"half", size:"40%"}, {id:"full", size:"80%"}]}` | Named ids — easier to drive imperatively |
| `activeSnapPoint`, `setActiveSnapPoint` | `state.activeId` (read), `ref.snapTo("id")` (write) | One state, one method |
| `dismissible={false}` | `allowed={["minimized", "full"]}` (omit "closed") | Same effect, declarative |
| `<Drawer.Overlay />` | Auto — render a `<div className="bs-backdrop" />` | Backdrop is a sibling div the engine targets |
| `direction="bottom" \| "top" \| "left" \| "right"` | `mode="bottom" \| "top" \| "left" \| "right"` | Same 4 axes |
| `modal={false}` | `inertSiblings={false}` + `focusTrap={false}` | We split modal into two flags |
| `nested` (sheets within sheets) | Just mount another `<BottomSheet>` | Auto-stacked via `sheetStack` singleton |
| `shouldScaleBackground` | — | Not exposed — we leave parent transforms alone |

### Code diff

**Before (vaul):**
```tsx
import { Drawer } from "vaul";

<Drawer.Root>
  <Drawer.Trigger>Open</Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay className="..." />
    <Drawer.Content className="...">
      <Drawer.Title>Settings</Drawer.Title>
      {/* content */}
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

**After (`@surdeddd/bottom-sheet`):**
```tsx
import { useRef } from "react";
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

const ref = useRef<BottomSheetHandle>(null);

<>
  <button onClick={() => ref.current?.snapTo("full")}>Open</button>
  <BottomSheet
    ref={ref}
    snapPoints={[{ id: "closed", size: 0 }, { id: "full", size: "85%" }]}
    initial="closed"
    focusTrap
    header={<h2>Settings</h2>}
  >
    {/* content */}
  </BottomSheet>
</>
```

## From `react-modal-sheet`

`react-modal-sheet` is also React-only with a Framer-Motion-driven animation.

### Prop mapping

| `react-modal-sheet` | `@surdeddd/bottom-sheet` | Notes |
| --- | --- | --- |
| `<Sheet isOpen={...} onClose={...}>` | `ref.snapTo("closed")` + `engine.on("close", ...)` | Ref-driven |
| `snapPoints={[0.5, 0.8]}` | `snapPoints={[{id:"half", size:"50%"}, ...]}` | Named ids |
| `springConfig={{stiffness: 300}}` | `spring={{stiffness: 300, damping: 28}}` | Same shape, name change |
| `<Sheet.Container>` | `<section className="bs-sheet">` | We don't use compound components |
| `disableDrag={true}` | Mount engine without `handle` ref | Removes drag attach |
| `tweenConfig` (Framer) | `animation="tween"` + `duration` + `easing` | Built-in tween, no Framer |

## What you gain

- **7 framework adapters** — React, Vue 3, Svelte 5, Solid, Lit, Web Component, Vanilla. `vaul` and `react-modal-sheet` are React-only.
- **4 sheet directions** — bottom, top, left, right. Both alternatives support bottom only (vaul has limited top support).
- **Hardware back interception** on Android — opt-in via `closeOnBack`.
- **WCAG 2.1 AA keyboard slider** — Arrow Up/Down stepping, Home/End, Esc, focus trap with restore.
- **iOS soft-keyboard awareness** via `visualViewport` API — sheet auto-clamps above keyboard.
- **Hardware-accelerated transform-only motion** — no layout thrash per frame.
- **No Framer-Motion / Radix dependencies** — `@surdeddd/bottom-sheet` is 7.7 KB gzipped core. `vaul` is 22 KB, `react-modal-sheet` + Framer is 60+ KB.

## What you lose

Honest list:

- **Radix-style compound components** — `vaul` uses `<Drawer.Trigger>`, `<Drawer.Title>`, etc. We use ref methods and a flat prop API. The plus side: less boilerplate, the minus: less explicit composition.
- **`shouldScaleBackground`** — `vaul`'s "background page scales down" effect on iOS is not built-in. You can replicate it with a `transform: scale(...)` driven by the `progress` event, but it's not one prop.
- **Animation library hooks** — `react-modal-sheet`'s direct Framer-Motion access (custom variants) isn't available. We expose `spring` config and `progress` events; that's enough for 95% of use cases.
- **Server actions integration** — `vaul` has special handling for Next.js Server Actions in modal context. We don't, but `inertSiblings + focusTrap` covers the same ground.

## See also

- [API reference](../README.md#api-at-a-glance)
- [Recipe gallery](recipes/README.md)
- [React docs](react.md)
