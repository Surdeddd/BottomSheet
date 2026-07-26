# WebGL renderer — design

**Date:** 2026-07-26
**Status:** approved, phase 1 in progress

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

## Testing

- **Unit** — feature installs and tears down cleanly; degrades when
  `WebGLRenderingContext` is absent; degrades under reduced motion; restores
  DOM paint on teardown and on context loss; never throws when the element is
  detached.
- **E2E** — a fixture page asserts the canvas mounts, matches the sheet rect,
  and that a `webglcontextlost` event restores a visible DOM sheet.
- **Size** — a dedicated `size-limit` entry for the subpath, and an assertion
  that the main entry does not grow.

## Non-goals

- Replacing the DOM renderer, or changing its behaviour in any way
- Text rendered on the GPU while the sheet is at rest — native text stays
  sharper; phase 3 will move it to the GPU only while in motion
- WebGPU. It is worth revisiting once Safari ships it broadly, but it would be
  a second backend behind this same feature boundary, not a different API.
