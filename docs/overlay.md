# Overlay

`OverlayEngine` is a panel that slides in from an edge and has two states,
open and closed. It has no snap points and no drag between sizes, and it is a
third of the size of the sheet engine (8.4 KB gzip). Use it for a dialog, a
side menu or a toast; use the [bottom sheet](../README.md) when the panel
rests at more than one size.

It is a separate entry and does not pull the sheet engine in:

```ts
import { OverlayEngine } from "@surdeddd/bottom-sheet/overlay";
import "@surdeddd/bottom-sheet/styles";
```

## Usage

```html
<div class="ovl-root">
  <div class="ovl-backdrop"></div>
  <section class="ovl-panel" data-edge="bottom" role="dialog" aria-label="Share">
    …
  </section>
</div>
```

```ts
const root = document.querySelector<HTMLElement>(".ovl-root")!;

const overlay = new OverlayEngine({
  element: root.querySelector<HTMLElement>(".ovl-panel")!,
  backdrop: root.querySelector<HTMLElement>(".ovl-backdrop")!,
  edge: "bottom",
  preset: "sheet",
});

document.querySelector("#share")!.addEventListener("click", () => overlay.open());
overlay.on("close", ({ reason }) => console.log("closed by", reason));
```

In React:

```tsx
import { Overlay } from "@surdeddd/bottom-sheet/react";

<Overlay open={open} edge="right" preset="sidebar" onClose={() => setOpen(false)}>
  <Menu />
</Overlay>;
```

`<Overlay>` takes every option below as a prop, plus `open`, `backdrop`,
`className`, `style`, `ariaLabel` and `onChange`. `useOverlay()` returns
`panelRef`, `backdropRef` and the methods, for markup of your own.

## Presets

A preset sets the animation, the backdrop and the swipe in one word. Any
option you pass next to it wins.

| Preset | Animation | Backdrop | Swipe to close |
| --- | --- | --- | --- |
| `sheet` | slide | 0.5 | yes |
| `dialog` | scale | 0.6, blurred | no |
| `sidebar` | slide | 0.4 | yes |
| `toast` | fade | none | no |

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `element` | required | The panel |
| `backdrop` | none | The dim layer |
| `edge` | `"bottom"` | `bottom`, `top`, `left` or `right` |
| `preset` | none | See above |
| `initialOpen` | `false` | Open as soon as it is created |
| `enterAnimation`, `exitAnimation` | `"slide"` | `slide`, `fade` or `scale` |
| `duration` | `320` | Milliseconds |
| `enterEasing`, `exitEasing` | a soft overshoot, ease-in | CSS easing strings |
| `backdropOpacity` | `1` | Opacity of the backdrop when open |
| `backdropFilter` | none | CSS `backdrop-filter`, for example `blur(8px)` |
| `swipeToClose` | off | `true`, or `{ threshold, velocityThreshold }`: a swipe closes the panel once it has moved it by that share of its size (0.3) or is faster than that many px/ms (0.5) |
| `closeOnEscape` | `true` | Escape closes the top overlay |
| `closeOnBackdrop` | `true` | A tap on the backdrop closes it |
| `closeOnOutsidePointer` | `false` | A press anywhere outside the panel closes it; for overlays without a backdrop |
| `closeOnBack` | `false` | The Back button closes it |
| `focusTrap` | `true` | Keep Tab inside the panel |
| `initialFocus` | first focusable | Element or selector to focus on open |
| `returnFocus` | the opener | Element, or a function that returns one |
| `lockBodyScroll` | `true` | Lock page scroll while open |
| `inertSiblings` | `false` | Make the rest of the page `inert` while open |
| `mountTo` | where it is | `"body"` or an element to move the panel to when it first opens; `destroy()` puts it back |
| `peek` | none | Bottom edge only: how much of the panel stays on screen when closed |
| `respectReducedMotion` | `true` | Skip the animation under `prefers-reduced-motion` |
| `onOpen`, `onClose` | none | Called when the overlay has opened and when it has closed |

## Methods and events

```ts
await overlay.open();
await overlay.close();
await overlay.toggle();
overlay.state;
overlay.destroy();

overlay.on("before-open", () => {});
overlay.on("open", () => {});
overlay.on("before-close", () => {});
overlay.on("close", ({ reason }) => {});
```

`state` is `{ isOpen, isAnimating }`. `reason` is `programmatic`, `escape`,
`backdrop`, `outside-pointer`, `swipe` or `back`.

Everything visual can change on a live overlay:

```ts
overlay.setOverlay({ preset: "dialog", backdropOpacity: 0.8 });
overlay.setBackdropOpacity(0.3);
overlay.setBackdropFilter("blur(12px)");
overlay.setSwipeToClose({ threshold: 0.5 });
overlay.setEnterAnimation("fade");
overlay.setExitAnimation("slide");
overlay.setReturnFocus(button);
```

`setOverlayChildren(node)` replaces the panel's content with a node, a
fragment or a function that returns one, and `clearOverlayChildren()` removes
it. `setOverlay({ children })` does the same as part of a batch.

## With sheets

Overlays and sheets share one stack. An overlay opened over a sheet goes on
top of it, Escape and the Back button close whichever is on top, and focus
returns down the stack as they close.

## Styling

The panel takes its surface, border and radius from the sheet's tokens, so an
overlay matches the sheets around it. Its own tokens are `--ovl-surface`,
`--ovl-surface-border`, `--ovl-radius`, `--ovl-shadow` and
`--ovl-backdrop-color`, set on `.ovl-root`.
