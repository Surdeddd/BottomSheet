# Right-to-left

The engine has always supported `left` and `right` — but those are *physical*
edges, and a right-to-left interface needs to say "the edge the text starts
from" without knowing which side that is. Two logical modes do that:

```ts
new BottomSheetEngine({
  element: sheet,
  handle,
  mode: "start",
  snapPoints: ["closed", "open"],
});
```

| Mode | LTR | RTL |
| --- | --- | --- |
| `start` | left | right |
| `end` | right | left |
| `left` / `right` | left / right | unchanged — physical, on purpose |
| `bottom` / `top` | unchanged | unchanged |

`bottom` and `top` are unaffected: writing direction does not move the bottom of
the viewport.

## How direction is decided

At construction the engine reads the direction that applies to the sheet
element and resolves the logical mode to a physical one, once. It checks:

1. `getComputedStyle(element).direction` — so a CSS `direction: rtl`, including
   one inherited from an ancestor, is honoured;
2. failing that, the nearest ancestor carrying a `dir` attribute.

With neither, it assumes `ltr`. Both checks are wrapped — an element detached
from the document, or an environment without `getComputedStyle`, resolves to
`ltr` rather than throwing.

```html
<html dir="rtl">
  <body>
    <!-- mode: "start" resolves to right -->
    <section class="bs-sheet"></section>
  </body>
</html>
```

The engine writes the resolved value to `data-mode` on the sheet element, which
is what the stylesheet matches on (`[data-mode="left"]`, `[data-mode="right"]`,
…). Adapters render the mode you passed, so a logical one briefly appears in
the markup before the engine mounts — there is no `[data-mode="start"]` rule,
so make sure the sheet is not visible before mount if that flash would matter
to you. After mount the attribute always holds a physical edge.

## What this does not do

**It does not re-resolve when direction changes at runtime.** Flipping
`dir="rtl"` on a mounted page leaves an already-built sheet on the edge it was
constructed with. Applications that let the user switch language mid-session
should rebuild the sheet — the same as they would for any other layout
direction change. This is a deliberate limit: watching `direction` per frame
would cost a `getComputedStyle` on the hot path for a property that changes
approximately never.

**It does not mirror your content.** The sheet's own chrome is symmetric, and
everything inside it is your markup. Use CSS logical properties
(`padding-inline-start`, `margin-inline-end`, `text-align: start`) there.

**Physical modes stay physical.** `mode: "left"` is the left edge in Arabic
exactly as in English. If you wanted the mirrored behaviour, that is what
`start` is for.

## Types

```ts
import type {
  SheetMode,          // "bottom" | "top" | "left" | "right" | "start" | "end"
  PhysicalSheetMode,  // "bottom" | "top" | "left" | "right"
  LogicalSheetMode,   // "start" | "end"
} from "@surdeddd/bottom-sheet";
```

`SheetMode` is what the engine accepts. Everything downstream of construction —
events, the resolved state, feature contexts — sees `PhysicalSheetMode`, because
by then the question is settled.
