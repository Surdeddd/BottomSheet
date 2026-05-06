# Media mini-player

> Spotify-style mini-player: always visible at ~80px, drag up for full controls.

```
┌─────────────────────┐    ┌─────────────────────┐
│                     │    │      art            │
│    feed / browse    │    │   ─────────         │
│                     │    │   track · artist    │
│                     │    │   ◀  ▶  ⏭          │
├─────────────────────┤    ├──── handle ─────────┤
│ [▶] track · artist  │    │ queue / lyrics      │
└─────────────────────┘    └─────────────────────┘
   minimized (80px)            full (90dvh)
```

## Why no closed state

A mini-player that can be dismissed is a UX bug — users lose access to playback. By restricting `allowed` to just `["minimized", "full"]`, the engine refuses any drag below the minimized snap.

## Code

```tsx
import { useEffect, useRef } from "react";
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

export function MiniPlayer({ track }: { track: { title: string; artist: string; art: string } }) {
  const ref = useRef<BottomSheetHandle>(null);

  // Lock to minimized/full — no dismiss possible.
  useEffect(() => {
    ref.current?.setAllowed(["minimized", "full"], "minimized");
  }, []);

  return (
    <BottomSheet
      ref={ref}
      snapPoints={[
        { id: "minimized", size: 80 },  // matches mini-player UI height
        { id: "full", size: "90dvh" },
      ]}
      initial="minimized"
      animation="spring"
      spring={{ stiffness: 260, damping: 28 }}
      backdrop={false}
      lockBodyScroll={false}
      closeOnEscape={false}
      header={null}
    >
      <div style={{ height: 80, display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
        <img src={track.art} alt="" width={56} height={56} style={{ borderRadius: 6 }} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>{track.artist}</div>
        </div>
        <button onClick={() => {/* toggle play */}} aria-label="Play">▶</button>
      </div>

      <div style={{ padding: 24, display: "grid", gap: 16 }}>
        <img src={track.art} alt="" style={{ width: "100%", borderRadius: 12 }} />
        <h2>{track.title}</h2>
        <p style={{ opacity: 0.7 }}>{track.artist}</p>
        {/* queue, lyrics, scrubber… */}
      </div>
    </BottomSheet>
  );
}
```

## Gotchas

- **`backdrop={false}` + `lockBodyScroll={false}`** — at "minimized" the user is browsing the feed; backdrop would block taps.
- **Match snap to UI height exactly** — if your mini-player row is 80px tall, the snap must be 80, not "10%". Mismatch creates a dead zone where drags feel mushy.
- **Tap vs. drag on the play button** — the engine treats short taps under 5px movement as clicks, so `<button>` works. But if your minimized row has 3+ controls, leave a clear drag zone (a handle area) to avoid arbitration confusion.

See also: [`docs/react.md`](../react.md) · [filter panel](./filter-panel.md) for similar `setAllowed` lock pattern · [main README](../../README.md).
