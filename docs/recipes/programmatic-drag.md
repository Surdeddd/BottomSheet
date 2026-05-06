# Programmatic drag (`dragTo`)

`engine.snapTo(id)` settles to a known snap. `engine.dragTo(px)` drives the sheet to ANY intermediate position — useful for preview scrubs, animated entrances, and gesture rehearsals.

```
        snapTo("full")      ── settles to "full" snap, fires `snap` event
        dragTo(420)         ── drives to 420px, no snap event, no activeId change
```

## When to use it

- **Preview scrub** — hover a button, sheet peeks halfway to show what's behind. Release → `snapTo` to commit or restore.
- **Animated entrance** — fancy curtain reveal: `dragTo(20)` → wait → `snapTo("minimized")`.
- **Gesture rehearsal** — record a drag, replay it programmatically (e.g. an onboarding tour).
- **Custom physics** — drive size from your own animation library while keeping engine state in sync.

## API

```ts
async dragTo(targetSize: number, velocityPxPerMs?: number): Promise<void>
```

- `targetSize` — px size, clamped to `[0, maxAxisSize]`
- `velocityPxPerMs` — initial spring velocity (default 0). Use this to chain a fling-like motion.
- Returns a Promise resolving when the animation settles.
- Does **NOT** update `activeId`. Does **NOT** emit `snap` event. Use `snapTo(id)` afterwards to commit.

## Example: hover preview

```tsx
import { useRef } from "react";
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";

export function PreviewSheet() {
  const ref = useRef<BottomSheetHandle>(null);

  return (
    <>
      <button
        onMouseEnter={() => {
          const engine = (ref.current as any)?.getEngine?.();
          // Peek to ~50% on hover, then settle back on leave.
          engine?.dragTo(window.innerHeight * 0.5);
        }}
        onMouseLeave={() => {
          ref.current?.snapTo("minimized");
        }}
      >
        Hover to peek
      </button>
      <BottomSheet
        ref={ref}
        snapPoints={[
          { id: "minimized", size: 96 },
          { id: "full", size: "85%" },
        ]}
        initial="minimized"
      >
        <YourContent />
      </BottomSheet>
    </>
  );
}
```

## Example: curtain reveal entrance

```ts
import { BottomSheetEngine } from "@surdeddd/bottom-sheet";

const engine = new BottomSheetEngine({...});
await engine.dragTo(20);              // tease — peek 20px
await new Promise(r => setTimeout(r, 80));
await engine.snapTo("minimized");     // commit to the real snap
```

## Gotchas

- **No snap event** — if your analytics fires on `snap`, dragTo intermediate positions are invisible. That's by design; `dragTo` is mid-gesture state, not a settled state.
- **No `activeId` change** — `state.activeId` stays at the last `snapTo`'d id. If you measure user intent via `activeId`, dragTo doesn't pollute it.
- **Concurrent gestures** — if the user is dragging while `dragTo` runs, the user wins (gesture cancels the in-flight animation).
- **Rubber band ignored** — `dragTo` clamps to `[0, maxAxisSize]` strictly. Use `snapTo` if you want the engine's spring overshoot at the edges.

## See also

- [Filter panel recipe](filter-panel.md) — uses `setAllowed` for a similar dynamic-state pattern
- [Comment composer recipe](comment-composer.md) — auto-expand on input focus is a snap, not a drag
- [API reference](../../README.md#api-at-a-glance)
