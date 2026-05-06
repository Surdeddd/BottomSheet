# Comment composer

> Chat-style compose sheet: minimized shows just the input bar; tap to expand to a keyboard-aware editor.

```
┌─────────────────────┐    ┌─────────────────────┐
│      feed           │    │                     │
│                     │    │   [ rich editor ]   │
│                     │    │                     │
│                     │    │                     │
├─────────────────────┤    ├─────────────────────┤
│ [ comment…   ][▶]   │    │ [ comment…   ][▶]   │
└─────────────────────┘    └─────────────────────┘
   minimized (60px)            full (above kbd)
```

## Why auto-expand on focus

The minimized bar is just bait — users tap it expecting to type. Snapping to `full` on focus removes a manual step. The engine's `visualViewport` integration then keeps the send button above the soft keyboard automatically.

## Code

```tsx
import { useRef, useState } from "react";
import { BottomSheet, type BottomSheetHandle } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

export function CommentComposer({ onSubmit }: { onSubmit: (text: string) => void }) {
  const ref = useRef<BottomSheetHandle>(null);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    onSubmit(text);
    setText("");
    ref.current?.snapTo("minimized");
  };

  return (
    <BottomSheet
      ref={ref}
      mode="bottom"
      snapPoints={[
        { id: "minimized", size: 60 },
        { id: "full", size: "85dvh" },
      ]}
      initial="minimized"
      allowed={["minimized", "full"]}
      animation="spring"
      backdrop={false}
      lockBodyScroll={false}
      closeOnEscape={false}      // Esc dismisses keyboard, not composer
      header={null}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        style={{ padding: 12, display: "flex", gap: 8, alignItems: "flex-end", height: "100%" }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => ref.current?.snapTo("full")}
          placeholder="Add a comment…"
          rows={1}
          style={{ flex: 1, resize: "none", padding: 8, borderRadius: 8 }}
        />
        <button type="submit" aria-label="Send">▶</button>
      </form>
    </BottomSheet>
  );
}
```

## Gotchas

- **`closeOnEscape={false}` is intentional** — iOS Safari's keyboard "Done" fires Esc-equivalent; we want that to dismiss the keyboard only.
- **`visualViewport` auto-clamp** — engine re-clamps `full` so the send button sits above the soft keyboard. Manual verification only (iOS 17+ Safari, Android 14 Chrome) — automated tests don't fire native keyboards.
- **Don't `position: fixed` the form** — fixed elements escape the sheet's transform during drag and tear visually.

See also: [`docs/react.md`](../react.md) · [comment thread](./comment-thread.md) for inner-scroll variant · [main README](../../README.md).
