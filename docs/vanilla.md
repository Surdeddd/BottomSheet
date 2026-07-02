# @surdeddd/bottom-sheet · Vanilla core

Use `BottomSheetEngine` directly when you don't want a framework wrapper —
e.g. inside Angular zones, Solid signals, Astro islands, or static HTML
without a build step.

## Install

```bash
npm i @surdeddd/bottom-sheet
```

## Usage

```ts
import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

const root = document.querySelector(".bs-root")!;
const sheet = root.querySelector(".bs-sheet") as HTMLElement;
const handle = root.querySelector(".bs-handle") as HTMLElement;
const content = root.querySelector(".bs-content") as HTMLElement;
const backdrop = root.querySelector(".bs-backdrop") as HTMLElement;

const engine = new BottomSheetEngine({
  element: sheet,
  handle,
  scrollContainer: content,
  backdrop,
  snapPoints: [
    { id: "minimized", size: 96 },
    { id: "half",      size: "45%" },
    { id: "full",      size: "85%" },
  ],
  initial: "minimized",
  animation: "spring",
  focusTrap: true,
  closeOnEscape: true,
});

// Settled-state events
engine.on("snap", ({ id, size }) => console.log("settled", id, size));

// 60fps progress (subscribe imperatively, do not store in framework state)
engine.on("progress", ({ value }) => {
  document.body.style.setProperty("--app-bs-progress", String(value));
});

backdrop.addEventListener("click", () => engine.close());
```

## Required HTML structure

```html
<div class="bs-root">
  <div class="bs-backdrop"></div>
  <section class="bs-sheet" data-mode="bottom" role="dialog" aria-modal="false">
    <div class="bs-handle" role="slider" tabindex="0" aria-label="Resize sheet">
      <h2>Title</h2>
    </div>
    <div class="bs-content">
      <!-- scrollable content -->
    </div>
  </section>
</div>
```

The engine writes inline styles + CSS variables (`--bs-size`,
`--bs-progress`) to the sheet element. The library's stylesheet handles
positioning, transitions, and fallbacks.

## Lifecycle

```ts
engine.snapTo("half");     // animate to a snap, returns Promise
engine.open();             // → first allowed snap with resolved size > 0
engine.close(reason?);     // → first snap that resolves to size 0, else first allowed
engine.expand();           // → largest allowed snap
engine.collapse();         // → smallest allowed snap with size > 0
engine.setAllowed(["min", "full"], "full");
engine.setSnapPoints(newPoints);
engine.recompute();        // re-measure a 'fit' / 'content' snap on demand
engine.getResolvedSnaps(); // → [{ id, size }] resolved to pixels right now
engine.destroy();          // remove all listeners + cancel animations
```

`open()` / `close()` resolve their target by **resolved size**, not by snap-id
name: `open()` picks the first allowed snap that currently measures > 0, and
`close()` picks the first snap that resolves to size 0 (falling back to the
first allowed). A snap literally named `"closed"` is not required.

## Runtime setters

Every knob can be flipped after construction — no remount:

```ts
engine.setPersistent(true);   // block dismissal (backdrop / Escape / back)
engine.setDisableClose(true); // block all closing, incl. programmatic
engine.setDisableDrag(true);  // suppress the drag gesture
engine.setRadius("28px");
engine.setMaxHeight("92dvh"); // string cap re-resolves on viewport / orientation change
engine.canDismiss();          // false while persistent / disableClose
```

## Cancelable events & focus

```ts
// Veto a transition — call cancel() synchronously:
engine.on("before-snap", ({ id, previousId, cancel }) => {
  if (formDirty) cancel();
});
engine.on("before-close", ({ reason, cancel }) => {
  if (reason === "backdrop" && formDirty) cancel();
});
```

Pass `initialFocus: false` to focus the sheet container itself (a
`tabindex=-1` is added if needed) instead of autofocusing the first field —
this keeps the iOS software keyboard from popping up when a sheet with an
`<input>` opens. A selector `string` or an `HTMLElement` targets a specific
element instead.

## Sheet manager

For route-driven config registries (e.g. mapping URL routes to per-screen
sheet configs), use `createSheetManager()`:

```ts
import { createSheetManager } from "@surdeddd/bottom-sheet";

const sheets = createSheetManager<"home" | "marker" | "panorama">({
  home:   { snapPoints: [...], allowed: ["min", "half", "full"] },
  marker: { snapPoints: [...], allowed: ["half", "full"], onOpen: () => focus() },
});

const cfg = sheets.resolve(currentRoute);
sheets.transition(prev, next); // runs onClose(prev) then onOpen(next)
```
