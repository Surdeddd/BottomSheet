# Wallet: send money

> Multi-step financial flow: pick recipient → enter amount → confirm. Each step is a snap point with full modal lockout.

```
recipients (50%)   amount (75%)       confirm (95%)
┌────────────┐     ┌────────────┐     ┌────────────┐
│ ● alice    │     │  $ [ 42 ]  │     │ Send $42   │
│ ● bob      │     │            │     │ to alice   │
│ ● carol    │     │  [Review]  │     │ [Confirm]  │
└────────────┘     └────────────┘     └────────────┘
```

## Why snap-as-step

Each form step gets its own sheet height — the sheet grows as commitment grows, no route changes. `before-snap` lets you guard "step back" before discarding state.

## Code

```tsx
import { useRef, useState } from "react";
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

export function SendMoney() {
  const ref = useRef<BottomSheetHandle>(null);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);

  return (
    <BottomSheet
      ref={ref}
      mode="bottom"
      snapPoints={[
        { id: "closed", size: 0 },
        { id: "recipients", size: "50%" },
        { id: "amount", size: "75%" },
        { id: "confirm", size: "95%" },
      ]}
      initial="recipients"
      animation="spring"
      backdrop lockBodyScroll inertSiblings focusTrap closeOnEscape closeOnBack
      onBeforeSnap={(e) => {
        // guard: leaving "amount" with a value entered → confirm
        if (e.from === "amount" && (e.to === "recipients" || e.to === "closed") && amount > 0) {
          if (!confirm("Discard amount and go back?")) e.preventDefault();
        }
      }}
      header={<h2>Send money</h2>}
    >
      <div style={{ padding: 16, display: "grid", gap: 24 }}>
        {["alice", "bob", "carol"].map((name) => (
          <button key={name} onClick={() => { setRecipient(name); ref.current?.snapTo("amount"); }}>{name}</button>
        ))}
        {recipient && (
          <label>Amount to {recipient}
            <input type="number" inputMode="decimal" value={amount || ""}
              onChange={(e) => setAmount(+e.target.value)} style={{ fontSize: 32 }} />
            <button onClick={() => ref.current?.snapTo("confirm")} disabled={amount <= 0}>Review</button>
          </label>
        )}
        {recipient && amount > 0 && (
          <button onClick={() => ref.current?.close()}>Confirm send ${amount} to {recipient}</button>
        )}
      </div>
    </BottomSheet>
  );
}
```

## Gotchas

- **`onBeforeSnap` must `preventDefault()` synchronously** — async modals won't block; use `confirm()` or pre-resolved state.
- **`inertSiblings` + `focusTrap`** — financial UX shouldn't allow tab-out or pointer-out on the dimmed page.
- **`closeOnBack: true`** — Android system back pops one snap level instead of closing. Verify on real device; Chrome desktop won't reproduce.

See also: [`docs/react.md`](../react.md) · [checkout drawer](./checkout-drawer.md) for related guard pattern · [main README](../../README.md).
