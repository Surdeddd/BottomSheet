# WebGL renderer

An opt-in renderer that paints the sheet surface on the GPU. The DOM renderer
remains the default and is unchanged — this adds a second way to draw, not a
replacement.

```bash
npm i @surdeddd/bottom-sheet
```

```ts
import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";

new BottomSheetEngine({
  element: sheet,
  handle,
  snapPoints: ["closed", "minimized", "full"],
  features: [webglRenderer()],
});
```

The subpath is only pulled into your bundle if you import it: the main entry
does not reference it. Measured cost when you do: **6.4 KB gzip**.

## What it draws, and what it does not

At rest the renderer paints the **surface**: the panel, its corner radii, its
shadow, and an edge sheen. Text stays native, so it keeps subpixel
antialiasing and stays selectable.

The moment a drag starts, the sheet's text is lifted into a texture and the
whole sheet — content included — becomes one deformable GPU surface: it bends
with drag velocity, and the glass distortion rises with the bend. When the
sheet settles, the text is handed straight back to the DOM.

Everything else stays where it was, drag or no drag:

| | handled by |
| --- | --- |
| layout | the DOM, unchanged |
| scrolling and its inertia | the browser's native scroll container |
| pointer gestures | the engine, on the same element |
| focus, roles, screen readers | real DOM nodes |
| text and controls | the DOM, on top of the canvas |

This is deliberate. Text drawn into a texture loses subpixel antialiasing and
cannot be selected, and controls inside a canvas are invisible to assistive
technology — so the texture exists only while the sheet is in motion, when none
of that is reachable anyway. Keeping content in the DOM the rest of the time
costs nothing and keeps the accessibility contract intact.

**What the capture covers.** Text with its computed font, colour and alignment,
wrapped to the element's width; element backgrounds and borders, including
corner radii; and `<img>` content drawn at its laid-out size.

The scroll container gets a texture of its own. It is clipped to the container,
so rows scrolled out of view never paint over the handle or the header, and it
follows the container's scroll position for as long as the content is lifted.
That matters when something scrolls the list during the drag: with
`fitContentToSnap`, a list scrolled to its very end is held in place while the
sheet expands, and the lifted rows stay exactly where the DOM rows are, so
nothing jumps when the content is handed back.

It deliberately skips inputs, buttons, select, SVG, canvas, video and iframes.
Those keep painting as DOM on top of the surface, so during a drag they slide
with the sheet without bending with it. If your sheet is mostly form controls,
set `liftContent: false` — the surface still renders on the GPU and the content
simply rides along.

A cross-origin image without CORS headers taints the 2D canvas, and the texture
upload — not the draw — is where that surfaces. The capture is dropped and the
sheet keeps its DOM content undeformed rather than failing.

While the renderer is active the sheet's chassis stops painting — the library
stylesheet drops the background and shadow of `.bs-sheet`, `.bs-handle`,
`.bs-header` and `.bs-footer` whenever `data-bs-webgl="on"` is present. If you
override those backgrounds in your own CSS with higher specificity, your paint
will sit on top of the GPU surface and you will see both.

**With `fitContentToSnap`.** The layout is the same as with the DOM renderer:
at rest the scroll container ends at the visible edge, so a scrollbar stays on
screen, and the footer is pinned to that edge. The pinned footer is not lifted
into the texture; it stays in the DOM and flat while the surface bends. While
the sheet moves it paints the sheet's surface colour, because rows pass behind
it during motion and a transparent footer would show them.

## Options

```ts
webglRenderer({
  jelly: 0.6,
  sheen: 0.35,
  glass: 0.6,
  shadow: 1,
  liftContent: true,
  dpr: window.devicePixelRatio,
  allowSoftware: false,
  onUnsupported: reason => console.info("sheet fell back:", reason),
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `jelly` | `0.5` | How far the surface bends under drag velocity. `0` disables the deformation; the surface still renders on the GPU. |
| `sheen` | `0.35` | Edge and top-light intensity. `0` gives a flat panel. |
| `glass` | `0.6` | Refraction of the lifted content, scaled by how hard the surface is bending. `0` keeps the texture undistorted. Has no effect when `liftContent` is `false`. |
| `shadow` | `1` | Multiplier on the shadow the shader casts. `0` removes it. |
| `liftContent` | `true` | Whether text is captured into a texture during motion so it bends with the surface. `false` keeps text in the DOM at all times. |
| `dpr` | `devicePixelRatio` | Drawing-buffer scale. Pin it lower (e.g. `1`) to trade sharpness for fill rate on weak GPUs. |
| `allowSoftware` | `false` | Draw even when the browser renders WebGL on the CPU. Off by default, see [Software rasterisers](#software-rasterisers). |
| `onUnsupported` | — | Called with the reason when the renderer declines or withdraws. |

## Degradation

The renderer is designed to fail into the DOM renderer, never into a blank
sheet. It declines to install, or removes itself mid-session, when:

| `reason` | When |
| --- | --- |
| `no-document` | server-side rendering — there is no DOM to draw over |
| `no-webgl` | no WebGL context available, or the context failed to initialise |
| `software-renderer` | the browser draws WebGL on the CPU and `allowSoftware` is not set |
| `reduced-motion` | the user has `prefers-reduced-motion: reduce` set |
| `context-lost` | the browser dropped the GL context (tab backgrounded, GPU reset, driver crash) |

In every case the sheet's own paint is restored and the canvas is removed. The
sheet keeps working — same snap points, same gestures, same events. Shipping
`webglRenderer()` to a browser without WebGL, or without a GPU behind it, is
safe and silent.

```ts
webglRenderer({
  onUnsupported: reason => {
    if (reason === "context-lost") reportToTelemetry("gpu-drop");
  },
});
```

## Software rasterisers

A browser on a machine without a usable GPU still hands out a WebGL context.
It draws that context on the CPU: SwiftShader in Chromium, llvmpipe in Mesa,
the Basic Render Driver on Windows. That covers virtual machines, remote
desktops, CI runners and laptops whose driver the browser has blocklisted.

There the renderer is a loss, not a gain. Measured in headless Chromium on
SwiftShader, on a 393×852 viewport, in CPU time per frame:

| Device pixel ratio | WebGL surface | DOM renderer |
| --- | --- | --- |
| 3 | 285–370 ms, 2–6 frames a second | 2.5 ms, 60 frames a second |
| 1 | 31 ms, about 30 frames a second | 2.5 ms, 60 frames a second |

So the renderer reads the name of the WebGL renderer and declines with
`software-renderer` when it names a software rasteriser. A browser that hides
the name is taken for a GPU.

`allowSoftware: true` skips the check. It is there for screenshots and tests
on machines without a GPU, where speed does not matter and the picture does.

## Where the surface is drawn

The canvas is a sibling of the sheet, stacked right under it. It takes the
sheet's own positioning, `fixed` or `absolute`, and fills the same containing
block, so the two stay together wherever the sheet lives:

- a sheet fixed to the viewport gets a canvas the size of the viewport;
- a sheet inside an ancestor with `transform`, `contain` or `filter` is drawn
  inside that ancestor, and clipped by it;
- a sheet positioned `absolute` inside a clipping container, a phone mock-up
  on a landing page for instance, is drawn inside the container and scrolls
  with it.

An ancestor that rotates or skews the sheet is not supported: the surface is
placed by bounding boxes.

## Colour and corners

The surface takes its colour and its corner radii from the sheet's computed
style, one radius per corner, so it rounds exactly the corners your CSS rounds.
They are read when the renderer installs and again:

- when the window is resized;
- when the system colour scheme changes;
- when an attribute changes on any ancestor of the sheet, or the sheet's own
  `class` does, which is how a theme class or a `data-theme` on `<html>`
  arrives. Ancestors are followed out of a shadow root, so the custom element
  is covered;
- after every drag and every snap.

A theme that arrives by another road, a swapped stylesheet for instance, is
picked up after the next move or resize.

## Frame budget

The renderer draws only while something moves. It repaints the moment the
engine moves the sheet, by watching the sheet's inline style, so the surface is
drawn in the same frame as the DOM it sits under rather than a frame behind it;
during a drag it draws once per frame from its own loop, which also carries the
deformation as it decays. The loop stops once the sheet has settled and the
deformation is flat. **A resting sheet costs zero frames**, matching the DOM
renderer, and scrolling the page under it does not redraw it.

## Adapters

No new API — every adapter already forwards `features`:

```tsx
import { useBottomSheet } from "@surdeddd/bottom-sheet/react";
import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";

const sheet = useBottomSheet({
  snapPoints: ["closed", "full"],
  features: [webglRenderer()],
});
```

```vue
<script setup>
import { useBottomSheet } from "@surdeddd/bottom-sheet/vue";
import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";

const sheet = useBottomSheet({
  snapPoints: ["closed", "full"],
  features: [webglRenderer()],
});
</script>
```

The custom element takes it through `options`:

```ts
import "@surdeddd/bottom-sheet/element";
import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";

document.querySelector("bottom-sheet").options = {
  features: [webglRenderer()],
};
```

Under SSR the feature never installs — it checks for `document` first — so
hydration is unaffected.

## Context and precision

The renderer asks for **WebGL2** first and falls back to WebGL1 — the shaders
are GLSL ES 1.00, which WebGL2 accepts unchanged, so this buys precision and
relaxed texture rules without a second shader dialect.

Precision matters more than it looks. The surface is drawn from a signed
distance field evaluated in drawing-buffer pixels, and on a dpr-3 phone those
run past four thousand. `mediump` carries ten bits of mantissa in Chromium —
roughly ±4px of error up there, which shows as crawling edges and corners that
do not quite match their radius. The fragment shader therefore compiles as
`highp`, guaranteed under WebGL2 and checked with `getShaderPrecisionFormat`
under WebGL1. A driver that advertises `highp` and then refuses to compile it
falls back to `mediump` rather than losing the renderer.

The context is created without multisampling. The surface is one triangle that
covers the canvas, and its edges are smoothed in the shader, so a multisampled
buffer would add memory and fill work and change nothing on screen.

It is created with `preserveDrawingBuffer`, which is not the usual advice. The
renderer draws on demand, not every frame, and without multisampling WebKit on
Linux puts each frame on screen one draw late: the first frame never shows, and
a new colour arrives with the next move. Keeping the buffer makes the frame
that was drawn the frame that is shown, in every engine.

## Browser support

WebGL 1 is required: Chrome 9, Safari 5.1, Firefox 4. In practice the floor is
the library's own baseline, documented in
[browser-support.md](./browser-support.md). Anything below it, or any browser
where the user has disabled WebGL, gets the DOM renderer.

## Frame cost of the capture

The capture runs once per gesture, on `dragstart`, and is thrown away when the
sheet settles. It walks the sheet's elements, draws their text into a 2D canvas
and uploads it as a texture — one frame's work, not per-frame work. A
`MutationObserver` re-takes it if the content changes mid-drag.

## What is not possible

Refracting **the page behind the sheet** is not achievable this way, and the
renderer does not pretend to: WebGL has no access to the pixels the browser
composited for the rest of the document, and there is no API that hands them
over. `glass` refracts the sheet's own lifted content, which is real
distortion of real pixels. Anything advertising background refraction over
arbitrary DOM is either re-rendering that DOM itself or faking it with a blur.

The design, including this constraint, is written up in
[webgl-renderer-design.md](./webgl-renderer-design.md).
