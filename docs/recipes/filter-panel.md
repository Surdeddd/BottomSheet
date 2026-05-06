# Filter panel

> E-commerce / map filters that are always at least partially visible — no full close.

```
┌─────────────────────┐
│      results        │
│      list / map     │
│                     │
├──── handle ─────────┤   ← always visible (≥ 80px)
│ Filters             │
│ [x] In stock        │
│ Price: ─●─────── $$ │
└─────────────────────┘
```

## Why no-close mode

Users scanning results want filters *one tap away*. A modal sheet that fully
closes hides the affordance. `setAllowed` lets you remove `"closed"` from
the snap allowlist while keeping a small `peek` snap as the floor.

## Code

```tsx
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";
import { useEffect, useRef, useState } from "react";

export function FilterPanel() {
  const ref = useRef<BottomSheetHandle>(null);
  const [inStock, setInStock] = useState(true);
  const [price, setPrice] = useState(50);

  useEffect(() => {
    // Lock to peek/half/full — no fully-closed snap allowed.
    ref.current?.setAllowed(["peek", "half", "full"], "peek");
  }, []);

  return (
    <BottomSheet
      ref={ref}
      snapPoints={[
        { id: "peek", size: 80 },
        { id: "half", size: "50%" },
        { id: "full", size: "92%" },
      ]}
      initial="peek"
      animation="spring"
      backdrop={false}
      lockBodyScroll={false}
      closeOnEscape={false}
      header={<h2>Filters</h2>}
    >
      <div style={{ padding: 16, display: "grid", gap: 16 }}>
        <label>
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
          In stock only
        </label>

        <label>
          Max price: ${price}
          <input
            type="range" min={0} max={500} value={price}
            onChange={(e) => setPrice(+e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>
    </BottomSheet>
  );
}
```

## Gotchas

- **`backdrop={false}` + `lockBodyScroll={false}`** — without these the page
  behind the sheet stays inert, defeating the purpose of always-visible
  filters.
- **Range slider drag conflict** — native `<input type="range">` swallows
  pointer events inside its track, so drags on it won't bubble to the
  engine. That's correct behavior, but verify on iOS Safari where touch
  arbitration differs.
- **`closeOnEscape={false}`** — Esc shouldn't dismiss a permanent panel.

See also: [`docs/react.md`](../react.md) · [main README](../../README.md).
