# Image gallery

> Pinterest-style image grid lives in a half sheet; flick up for fullscreen viewer.

```
┌─────────────────────┐    ┌─────────────────────┐
│      map / hero     │    │                     │
│                     │    │      photo          │
├──── handle ─────────┤    │      fullscreen     │
│ [img] [img] [img]   │    │                     │
│ [img] [img] [img]   │    ├──── handle ─────────┤
│ [img] [img] [img]   │    │ [img] [img] [img]   │
└─────────────────────┘    └─────────────────────┘
       half (45%)                 full (90%)
```

## Why this pattern

- A grid of square previews is **touch-friendly** at half-height — the user
  scans without committing.
- Swipe-up promotes the same content to a full viewer with no route change.
- Flicking down dismisses — easier than hunting for an `X` on mobile.

## Code

```tsx
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";
import { useState } from "react";

export function GallerySheet({ photos }: { photos: { id: string; url: string }[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <BottomSheet
      snapPoints={[
        { id: "peek", size: 120 },
        { id: "half", size: "45dvh" },
        { id: "full", size: "90%" },
      ]}
      initial="half"
      animation="spring"
      spring={{ stiffness: 240, damping: 26 }}
      header={<h2>{selected ? "Photo" : `${photos.length} photos`}</h2>}
      onChange={(s) => { if (s.activeId !== "full") setSelected(null); }}
    >
      {selected ? (
        <img src={selected} alt="" style={{ width: "100%", display: "block" }} />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
          padding: 4,
        }}>
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.url)}
              style={{ aspectRatio: "1", padding: 0, border: 0 }}
            >
              <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
```

## Gotchas

- **Grid scroll vs. drag** — the `bs-content` container scrolls vertically;
  the engine yields drag to scroll until `scrollTop === 0`. Don't wrap the
  grid in extra `overflow: auto` divs or you'll fight the engine.
- **Image height jumps** — set `aspectRatio: 1` (or fixed `height`) on grid
  cells; reflows during drag will tank FPS.

See also: [`docs/react.md`](../react.md) · [main README](../../README.md).
