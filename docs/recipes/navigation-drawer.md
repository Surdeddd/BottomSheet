# Navigation drawer

> Material You-style left drawer with a peek pull-tab; tap backdrop or Esc to dismiss.

```
┌──┬──────────────────┐
│  │     page         │
│≡ │                  │   ← hamburger toggles "full"
│  │                  │
│  │                  │
└──┴──────────────────┘
   peek (pull-tab)        full (75% width)
```

## Why this pattern

- A visible "peek" tab beats a hidden gesture — discoverability matters.
- Backdrop tap and Esc both dismiss, matching Material spec.

## Code

```tsx
import { useRef } from "react";
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

const ROUTES = [
  { href: "/", label: "Home" },
  { href: "/inbox", label: "Inbox" },
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Settings" },
];

export function NavDrawer() {
  const ref = useRef<BottomSheetHandle>(null);

  return (
    <>
      <button
        aria-label="Open navigation"
        onClick={() => ref.current?.snapTo("full")}
        style={{ position: "fixed", top: 12, left: 12, zIndex: 1 }}
      >≡</button>

      <BottomSheet
        ref={ref}
        mode="left"
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "peek", size: 24 },     // narrow pull-tab
          { id: "full", size: "75%" },  // 75% of viewport width
        ]}
        initial="peek"
        animation="spring"
        backdrop closeOnEscape focusTrap
        header={<h2 style={{ padding: 16 }}>Menu</h2>}
      >
        <nav style={{ display: "grid", gap: 4, padding: 8 }}>
          {ROUTES.map((r) => (
            <a
              key={r.href}
              href={r.href}
              onClick={() => ref.current?.snapTo("closed")}
              style={{ padding: "12px 16px", borderRadius: 8, textDecoration: "none" }}
            >{r.label}</a>
          ))}
        </nav>
      </BottomSheet>
    </>
  );
}
```

## Gotchas

- **`mode: "left"` swaps drag axis to X** — `size` values are widths, not heights. `"75%"` means 75% of viewport width.
- **Peek visibility** — at 24px the pull-tab must be styled to look tappable; add a vertical handle or icon inside `header` for affordance.
- **Hamburger z-index** — the backdrop (z-index 9998 by default) sits above page content; place the toggle button at z-index 1 so it ducks under the open drawer but stays visible when closed.

See also: [`docs/react.md`](../react.md) · [main README](../../README.md).
