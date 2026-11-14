# Without a framework

`BottomSheetEngine` is the engine every adapter wraps. Use it directly when
there is no framework, or when you want markup the components do not give you.

```bash
npm i @surdeddd/bottom-sheet
```

If all you need is a sheet on a page without a build step, the
[custom element](web-component.md) is less work.

## Markup

```html
<div class="bs-root">
  <div class="bs-backdrop"></div>
  <section class="bs-sheet" data-mode="bottom" role="dialog" aria-label="Filters">
    <div class="bs-handle" role="slider" tabindex="0" aria-label="Resize sheet"></div>
    <div class="bs-header"><h2>Filters</h2></div>
    <div class="bs-content">…</div>
    <div class="bs-footer"><button>Apply</button></div>
  </section>
</div>
```

The root and the sheet are required: `.bs-root` holds the default tokens,
`.bs-sheet` is the sheet. The handle, header, footer and backdrop are
optional; `.bs-content` is the part that scrolls. `data-mode` is written by the
engine too, but having it in the markup places the sheet correctly before the
script runs.

## The engine

```ts
import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

const root = document.querySelector<HTMLElement>(".bs-root")!;
const backdrop = root.querySelector<HTMLElement>(".bs-backdrop")!;

const sheet = new BottomSheetEngine({
  element: root.querySelector<HTMLElement>(".bs-sheet")!,
  handle: root.querySelector<HTMLElement>(".bs-handle")!,
  scrollContainer: root.querySelector<HTMLElement>(".bs-content")!,
  backdrop,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "open", size: "fit" },
  ],
  initial: "closed",
  focusTrap: true,
});

document.querySelector("#filters")!.addEventListener("click", () => sheet.open());

backdrop.addEventListener("click", () => {
  if (sheet.canDismiss()) void sheet.close("backdrop");
});

sheet.on("closed", () => console.log("gone"));
```

The engine fades the backdrop but does not listen to it; the tap-to-close
handler above is the one the components install.

The element options, next to the [options every adapter shares](../README.md#options):

| Option | What it is |
| --- | --- |
| `element` | The sheet. Required |
| `handle` | The grabber; also the keyboard slider. Without it, the whole sheet starts a drag |
| `scrollContainer` | The scroll area. A touch on it drags the sheet until the sheet is fully open, then scrolls |
| `backdrop` | The dim layer; the engine sets its opacity |
| `scrim` | A second layer for content behind the sheet; fades in with `progress` |

## Methods, events, state

The [README](../README.md#methods) lists them. In short:

```ts
await sheet.snapTo("open");
await sheet.close();
sheet.setAllowed(["open"]);
sheet.on("snap", ({ id, size, progress }) => {});
sheet.state.phase;
sheet.destroy();
```

`destroy()` detaches the engine: its listeners, observers, the scroll lock and
the focus trap all go. Call it when the markup goes away.

`open()` goes to the first allowed point with a size above zero, and `close()`
to the point of size zero, whatever their ids are. A sheet without a zero
point has nothing to close to; `close()` then takes it to its smallest point.

## Following the sheet

The engine writes `--bs-size` (pixels) and `--bs-progress` (0 to 1) on the
sheet and on `.bs-root` on every frame, so anything inside the root can follow
the sheet in CSS:

```css
.bs-root .fab {
  bottom: calc(var(--bs-size) + 16px);
}
```

For the rest of the page, copy the value to wherever you need it:

```ts
sheet.on("progress", ({ value }) => {
  document.documentElement.style.setProperty("--sheet-progress", String(value));
});
```

## Waiting for the history

With `closeOnBack` or `routedTo`, closing the sheet goes one step back in the
history, and the browser does that asynchronously. `await sheet.close()`
resolves after it. Code that does not await the close can wait for the history
itself before navigating:

```ts
import { historySettled } from "@surdeddd/bottom-sheet";

void sheet.close();
await historySettled();
router.push("/next");
```

## Several sheets

Create one engine per sheet. They stack in the order they open: each new one
goes on top, Escape and the Back button close the top one, and focus returns
down the stack as they close. `sheet.isTop()` and `sheet.depth()` tell a sheet
where it is.

## Sheet manager

`createSheetManager()` is a small registry for apps where the route decides
which sheet configuration applies:

```ts
import { createSheetManager } from "@surdeddd/bottom-sheet";

const sheets = createSheetManager<"home" | "place">({
  home: { snapPoints: homePoints, allowed: ["peek", "half", "full"] },
  place: { snapPoints: placePoints, allowed: ["half", "full"], onOpen: focusPlace },
});

sheets.transition(previousRoute, nextRoute);
const config = sheets.resolve(nextRoute);
if (config?.snapPoints) sheet.setSnapPoints(config.snapPoints, config.allowed);
```

`transition()` calls `onClose` of the route you leave and `onOpen` of the one
you enter. It holds configuration only; applying it to an engine is up to you.

## A smaller engine

`BottomSheetEngine` includes every optional feature.
[`BottomSheetCore`](../README.md#slim-core) starts without them and takes the
ones you list.
