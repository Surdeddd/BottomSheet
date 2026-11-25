# WebGL renderer — design

**Date:** 2026-07-26
**Status:** shipped; experimental from 0.24.2 through 0.25, out of that stage since 0.26. See [Known issues](webgl.md#known-issues).
Revised in 0.24.4, see [What changed in 0.24.4](#what-changed-in-0244).

## Problem

The sheet paints through the DOM: a `transform` on `.bs-sheet`, CSS custom
properties for size and progress, a sibling element for the scrim. That is fast
and accessible, but it caps what the surface can look like. Effects that need
per-pixel work — refraction of the page behind the sheet, a surface that
deforms with drag velocity, specular light along a moving edge — have no CSS
expression.

The goal is a GPU-rendered sheet as an **opt-in alternative**. The DOM renderer
stays the default and stays unchanged: consumers who do not opt in must see no
behaviour change and no added bytes.

## Key insight

"Render the sheet in WebGL" does not require reimplementing layout, scrolling,
input, or accessibility. The DOM stays in the page and keeps doing all four —
it simply stops painting. WebGL draws on top, reading geometry the browser has
already computed.

This means:

| concern | who handles it |
| --- | --- |
| layout | browser (DOM, unchanged) |
| scrolling and its inertia | browser (native scroll container) |
| pointer gestures | existing engine, on the same element |
| focus, roles, screen readers | real DOM nodes, unchanged |
| pixels | WebGL |

The fallback is therefore free: drop the transparency and the DOM renderer is
already there, because it never left.

## Architecture

Three layers, only the third is new:

1. **`BottomSheetCore`** — untouched. Physics, snap resolution, events.
2. **DOM layer** — untouched. Real nodes, real scroll, real a11y tree. Under
   the WebGL renderer its paint is suppressed (`color: transparent`,
   `background: transparent`), never its layout or hit-testing.
3. **`@surdeddd/bottom-sheet/webgl`** — new subpath. Owns a canvas, a GL
   context, shaders, and a frame loop driven by engine events.

### Packaging

A subpath export consumed as an `EngineFeature`, not a config string:

```ts
import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";

new BottomSheetEngine({
  element,
  snapPoints: ["closed", "minimized", "full"],
  features: [webglRenderer({ jelly: 0.6, refraction: true })],
});
```

A bare `renderer: "webgl"` option was rejected: a string cannot carry code, so
the shaders would have to live in the main entry and cost every consumer bytes
they never execute. An import-time factory costs nothing to those who skip it,
and `EngineFeature` is an contract the library already has.

Adapters need no new API — they already forward `features`.

### Geometry sync

The renderer never computes layout. Per frame it reads:

- the sheet rect via `getBoundingClientRect()` (cached; invalidated on resize,
  snap change, and content mutation)
- `--bs-size` and `--bs-progress`, which the core already writes
- drag velocity from the `drag` event payload, for deformation

### Frame budget

The renderer draws only while something moves: it subscribes to `dragstart` /
`drag` / `dragend` / `progress` and stops the loop once the sheet settles and
the last effect has decayed. A resting sheet costs zero frames, matching the
current DOM renderer's behaviour.

## Degradation

The feature removes itself, restoring the DOM paint, when any of these hold:

- `WebGLRenderingContext` is unavailable, or context creation returns null
- the context is drawn on the CPU by a software rasteriser, unless
  `allowSoftware` is set
- `prefers-reduced-motion: reduce`
- the GL context is lost (`webglcontextlost`) — including mid-session
- SSR: no `document`, so the feature never installs

Degradation is not an error path — it is a supported mode. A consumer who ships
`webglRenderer()` to a browser without WebGL gets the standard sheet, silently.

## Phases

All three shipped.

1. **Frame** — subpath, context lifecycle, sheet surface on the GPU (panel,
   corner radii, shadow), engine sync, degradation, size budget, tests, docs.
2. **Content in motion** — text lifted into a texture on `dragstart` and handed
   back on settle, so the whole sheet bends as one surface. This replaced the
   originally drafted "content from data" node schema: capturing the DOM the
   consumer already wrote covers the same ground without inventing a second
   layout system, and it works with arbitrary markup instead of a fixed set of
   node types.
3. **Effects** — velocity-driven bend, edge and top-light sheen, and glass
   refraction of the lifted content that scales with the bend.

### The refraction that is not there

The draft promised "refraction of the backdrop". That is not achievable and the
shipped renderer does not claim it: WebGL cannot read the pixels the browser
composited for the rest of the page, and no API exposes them. What ships
refracts the sheet's own captured content — real distortion of real pixels.
Background refraction would require re-rendering the page into the texture,
which is a different product.

## What changed in 0.24.4

The first shipped renderer moved visibly at the two ends of a drag and shook in
the middle of one. Three decisions in this document were behind that, and all
three were reversed.

**The bend is driven by the sheet, not by the pointer.** The draft read "drag
velocity from the `drag` event payload". The payload carries the distance from
where the drag began, not a velocity, so past a short pull the bend sat at its
limit and jumped back to it on every pointer event. The bend is now a damped
spring that follows the real position of the sheet's leading edge in real
time. It needs nothing from the event but a wake-up, and it works the same for
a drag, a snap animation and a sheet on any side.

**The surface is the default, the content lift is opt-in.** Lifting the
content into a texture is the only part that can disagree with the DOM, so it
is no longer on unless asked for, and it is a separate export:
`webglRenderer({ lift: contentLift() })`. The surface alone is 5.5 KB; the lift
adds 4.2 KB to those who import it.

**The lift reproduces, it does not re-lay-out.** The first capture laid text
out on a 2D canvas on its own. The current one draws only what it can
reproduce exactly and leaves the rest in the DOM:

- text is drawn line by line from the boxes the browser reports, at the
  baseline the layout engine reports for that font;
- every line, box and image is put on the device pixel row the browser put it
  on. Chromium and Firefox count rows from the corner of the transformed
  sheet, WebKit from the screen;
- the texture replaces the DOM only once the sheet has moved, so a press alone
  changes nothing, and it is handed back while the sheet still travels.

One browser behaviour is worked around rather than matched. Chromium paints
text on different rows depending on whether its layer carries
`will-change: transform`, and does not repaint when the hint is dropped. The
hand-back repaints the text, so the renderer holds the hint for that one
frame; otherwise lines would land a pixel away from where the drag found them.

## What changed in 0.25.1

**The bend is opt-in.** Seen on a real screen at the speed of a flick, the
corners of the leading edge stood up to 22 px above its middle, and with the
content left in the DOM nothing else followed them. The default strength is
now `0`: the surface is flat and only moves with the sheet. `jelly` asks for
the bend, and the content lift, which exists to follow it, needs it.

**The bend stops at the far edge.** The shader moved the whole surface by the
bend of the leading edge, so the opposite edge carried the same curve. That
edge is out of sight for a sheet that sits flush against the screen, until the
sheet is dragged past its largest snap point and lifts off it; then the curve
showed, and wobbled. The displacement now falls off linearly along the sheet
and is zero at the far edge. The shader inverts that mapping exactly, so the
lifted content is squeezed by the same few percent as the surface.

**The surface follows a transition on the sheet.** The loop ran while the
engine moved the sheet and stopped as soon as it rested. A CSS transition
moves the sheet without the engine: the stylesheet's own `bottom 0.2s`, which
lifts a sheet above the on-screen keyboard, left the surface where it was,
300 px under the content. The loop now also runs while the sheet element has a
running transition, and a `transitionrun` on the sheet wakes it.

## What changed in 0.26.0

**A frame is skipped only while the sheet is where it was drawn.** A write to
the sheet's style is drawn in the same task, so that the surface never trails
the DOM by a frame, and the loop then skipped its next draw. That draw shows
the sheet where the write found it: at the start of a transition, when the
stylesheet is the one moving it. A frame that came later than the end of the
transition found nothing animating, drew nothing, and the loop went to sleep
with the surface 150 px away. WebKit counts a transition from the moment it is
created, so one stalled frame is enough there. The loop now keeps the box of
that draw and compares it with the sheet's.

**One context for a sheet.** The check for WebGL created a context of its own
and lost it at once. It now only looks for the constructors.

**The handle of a side sheet is transparent under the renderer.** The rule
that clears it lost to a later rule of the same specificity, and the DOM
painted the handle over the bend of the leading edge.

**The canvas cannot be selected.** WebKit tints a selected canvas like a
selected image, and a selection across the page covered the whole surface.

## Testing

- **Unit** — feature installs and tears down cleanly; degrades when
  `WebGLRenderingContext` is absent; degrades under reduced motion; restores
  DOM paint on teardown and on context loss; never throws when the element is
  detached.
- **E2E** — a fixture page asserts the canvas mounts, matches the sheet rect,
  and that a `webglcontextlost` event restores a visible DOM sheet.
- **Size** — two `size-limit` entries for the subpath, with and without the
  content lift, and an assertion that the main entry does not grow.
- **Pixels** — the fixture is screenshotted at rest, under a press, with the
  content lifted and after the hand-back; the frames are compared pixel by
  pixel in all three engines.

## Non-goals

- Replacing the DOM renderer, or changing its behaviour in any way
- Text rendered on the GPU while the sheet is at rest — native text stays
  sharper; phase 3 will move it to the GPU only while in motion
- WebGPU. It is worth revisiting once Safari ships it broadly, but it would be
  a second backend behind this same feature boundary, not a different API.
