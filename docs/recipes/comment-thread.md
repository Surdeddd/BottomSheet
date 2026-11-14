# Comment thread

A thread of nested replies in a sheet, with a reply field that stays in view
at every snap point and above the on-screen keyboard.

```text
┌─────────────────────┐
├──── handle ─────────┤
│ 12 comments         │
│ @alice  · 2h        │
│   look at this      │
│   ├ @bob: agreed    │   ← scrolls
│   └ @cara: nope     │
│ @dave · 1h          │
├─────────────────────┤
│ [ reply…       ][▶] │   ← footer: always on screen
└─────────────────────┘
```

## Code

```tsx
import { useState } from "react";
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

type Comment = { id: string; author: string; text: string; replies?: Comment[] };

export function ThreadSheet({ comments }: { comments: Comment[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>{comments.length} comments</button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "half", size: "50%", dragFromContent: false },
          { id: "full", size: "92%", dragFromContent: false },
        ]}
        fitContentToSnap
        focusTrap
        header={<h2>{comments.length} comments</h2>}
        footer={<ReplyForm />}
      >
        {comments.map(comment => (
          <CommentNode key={comment.id} comment={comment} />
        ))}
      </BottomSheet>
    </>
  );
}

function ReplyForm() {
  return (
    <form
      onSubmit={event => event.preventDefault()}
      style={{ display: "flex", gap: 8 }}
    >
      <input name="reply" placeholder="Reply…" style={{ flex: 1 }} />
      <button type="submit">Send</button>
    </form>
  );
}

function CommentNode({ comment }: { comment: Comment }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <strong>@{comment.author}</strong> <span>{comment.text}</span>
      {comment.replies && (
        <div style={{ paddingLeft: 16, borderLeft: "2px solid #eee" }}>
          {comment.replies.map(reply => (
            <CommentNode key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## What each option is for

- **`footer`** puts the reply form below the list. With
  [`fitContentToSnap`](../content-fit.md) it sits at the bottom of the visible
  part of the sheet at the half point too, not under the screen edge, and the
  last comment can be scrolled into view above it.
- **`dragFromContent: false`** on the open points lets a finger scroll the
  comments at half height. The handle and the header still move the sheet.
  Without it, a swipe on the list first pulls the sheet up to its largest
  point and only then scrolls.
- **`focusTrap`** moves focus into the sheet when it opens and keeps Tab
  inside it. Focus goes to the handle, so the phone keyboard stays down until
  the reader taps the field. To start in the field, add
  `initialFocus="[name=reply]"`.
- **The keyboard needs no code.** When the field is focused, the sheet lifts
  to rest on top of the keyboard and its largest point is capped to the space
  that is left, so the form stays visible.

## Things to know

- Keep one scroll container. A second scrolling element inside the content
  takes the gesture away from the sheet.
- Do not make the form `position: fixed`. A fixed element ignores the sheet's
  transform and would stay behind while the sheet moves. The footer is the
  place for it.

See also: [comment composer](./comment-composer.md) ·
[content at every snap point](../content-fit.md) · [React guide](../react.md).
