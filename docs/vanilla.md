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
engine.open();             // → first non-closed allowed
engine.close();            // → "closed" or first allowed
engine.setAllowed(["min", "full"], "full");
engine.setSnapPoints(newPoints);
engine.destroy();          // remove all listeners + cancel animations
```

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
