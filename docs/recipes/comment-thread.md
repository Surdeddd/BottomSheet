# Comment thread

> Twitter/Reddit-style nested replies in a sheet, with a sticky reply input that stays above the keyboard.

```
┌─────────────────────┐
├──── handle ─────────┤
│ @alice  · 2h        │
│   look at this      │
│   ├ @bob: agreed    │   ← scrolls inside content
│   └ @cara: nope     │
│ @dave · 1h          │
│   ...               │
├─────────────────────┤
│ [ reply…       ][▶] │   ← stays above virtual keyboard
└─────────────────────┘
```

## Inner-scroll vs. drag

The engine watches `scrollContainer.scrollTop`:

- `scrollTop > 0` → drag goes to the scroller (the user is reading).
- `scrollTop === 0` and the user pulls down → the engine takes over and
  drags the sheet.

You don't wire this manually — it's the default for `bs-content`. Just don't
nest a second scroller.

## Code

```tsx
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";
import { useEffect, useState } from "react";

type Comment = { id: string; author: string; text: string; replies?: Comment[] };

export function ThreadSheet({ comments }: { comments: Comment[] }) {
  const [kbInset, setKbInset] = useState(0);

  // Keyboard-aware: shrink content to leave room for input above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKbInset(window.innerHeight - vv.height - vv.offsetTop);
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", onResize); };
  }, []);

  return (
    <BottomSheet
      snapPoints={[{ id: "half", size: "50%" }, { id: "full", size: "92%" }]}
      initial="half"
      animation="spring"
      focusTrap
      header={<h2>{comments.length} comments</h2>}
    >
      <div style={{ paddingBottom: 64 + kbInset }}>
        {comments.map((c) => <CommentNode key={c.id} c={c} />)}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); /* post */ }}
        style={{
          position: "sticky",
          bottom: kbInset, // rises with the keyboard
          background: "var(--bs-surface, #fff)",
          padding: 12,
          display: "flex",
          gap: 8,
        }}
      >
        <input name="reply" placeholder="reply…" style={{ flex: 1 }} />
        <button type="submit">Send</button>
      </form>
    </BottomSheet>
  );
}

function CommentNode({ c }: { c: Comment }) {
  return (
    <div style={{ padding: "8px 16px" }}>
      <strong>@{c.author}</strong> <span>{c.text}</span>
      {c.replies && (
        <div style={{ paddingLeft: 16, borderLeft: "2px solid #eee" }}>
          {c.replies.map((r) => <CommentNode key={r.id} c={r} />)}
        </div>
      )}
    </div>
  );
}
```

## Gotchas

- **iOS visualViewport quirk** — Safari < 16 fires `resize` only after the
  keyboard fully animates in. Use `scroll` as a fallback (already wired
  above).
- **Don't `position: fixed` the input** — fixed elements ignore the sheet's
  transform; use `sticky` so it rides with the sheet's content frame.

See also: [`docs/react.md`](../react.md) · [main README](../../README.md).
