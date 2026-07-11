# Checkout drawer

Stripe-style payment drawer that slides up over the page, locks body scroll, traps focus, and **guards against accidental dismissal** while a payment is in flight.

```
   ┌──────────────┐
   │   page bg    │  ← inert + dimmed
   │              │
   │ ┌──────────┐ │
   │ │ Pay      │ │  ← sheet at "full"
   │ │ Card #   │ │
   │ │ [Submit] │ │
   │ └──────────┘ │
   └──────────────┘
```

## Why a sheet here

A modal works for desktop, but mobile checkout flows benefit from sheet-native feel: drag-to-dismiss with an obvious physical handle, status bar still visible, ability to collapse to a "minimized" preview while the user reads terms and re-expand seamlessly.

## React

```tsx
import { useRef, useState } from "react";
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

export const CheckoutDrawer = () => {
  const ref = useRef<BottomSheetHandle>(null);
  const [paying, setPaying] = useState(false);

  return (
    <BottomSheet
      ref={ref}
      snapPoints={[
        { id: "closed", size: 0 },
        { id: "preview", size: "fit" },        // shows order summary only
        { id: "full", size: "85dvh" },
      ]}
      initial="full"
      allowed={paying ? ["full"] : ["closed", "preview", "full"]}
      animation="spring"
      focusTrap
      closeOnEscape={!paying}
      lockBodyScroll
      inertSiblings
      // Veto any dismissal while a payment is in flight. Both fire a
      // synchronous cancel() — see the Gotchas below.
      onBeforeSnap={(e) => { if (paying && e.size === 0) e.cancel(); }}
      onBeforeClose={(e) => { if (paying) e.cancel(); }}
      header={<h2>Pay $42.00</h2>}
    >
      <CardForm onSubmit={async data => {
        setPaying(true);
        await processPayment(data);
        setPaying(false);
        ref.current?.close();
      }} />
    </BottomSheet>
  );
};
```

## Gotchas

- **`cancel()` must run synchronously** — `onBeforeSnap` / `onBeforeClose` freeze the cancel callback after the synchronous emit phase, so an async guard (promise, `setTimeout`, a modal `await`) won't block. Gate on already-resolved state like `paying`. `onBeforeSnap` covers drag-to-dismiss (a snap to `size === 0`); `onBeforeClose` covers backdrop / Escape / back / programmatic `close()`.
- **Use `inertSiblings: true`** — otherwise screen-readers and keyboard users can tab into the dimmed page behind the sheet.
- **Don't disable `focusTrap` while paying** — auto-focus on the submit button at the moment of dragging "preview→full" is part of the magic. Trap is what makes Tab cycling work without a custom keymap.
- **Disable `closeOnEscape` during the network call** — accidental Esc kills the payment UX.
- **`size: "fit"`** for the "preview" state auto-resolves to the natural height of your `<header>` slot (handle + summary line), so you don't have to hard-code 96 vs 110px depending on font.

## See also

- [React adapter →](../react.md)
- [Filter panel](filter-panel.md) — similar `setAllowed` ramp pattern
