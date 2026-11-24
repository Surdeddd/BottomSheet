# WebGL renderer

> **Experimental.** The renderer is checked under automation in Chromium,
> Firefox and WebKit, on macOS and Linux, but not yet across real phones. Its
> options may change, or the renderer may be removed, before 1.0. In
> production, use the default DOM renderer. See [Known issues](#known-issues).

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
does not reference it. Measured cost when you do: **5.5 KB gzip** for the
surface, and **4.2 KB more** for the [content lift](#lifting-the-content), which
is a separate export and stays out of the bundle unless you import it.

## What it draws, and what it does not

The renderer paints the **surface**: the panel, its corner radii, its shadow,
and an edge sheen. While the sheet moves, the surface bends: the middle of its
leading edge stays on the sheet and the corners trail behind, like a sheet of
jelly, and it is flat again about a third of a second after the sheet stops.

Everything else stays where it was, drag or no drag:

| | handled by |
| --- | --- |
| layout | the DOM, unchanged |
| scrolling and its inertia | the browser's native scroll container |
| pointer gestures | the engine, on the same element |
| focus, roles, screen readers | real DOM nodes |
| text and controls | the DOM, on top of the canvas |

This is deliberate. Text drawn into a texture cannot be selected, and controls
inside a canvas are invisible to assistive technology. Keeping content in the
DOM costs nothing and keeps the accessibility contract intact. The content
rides on the sheet as it always did; only the surface under it bends, and the
bend is kept small on the inward side so that it never uncovers content.

While the renderer is active the sheet's chassis stops painting — the library
stylesheet drops the background and shadow of `.bs-sheet`, `.bs-handle`,
`.bs-header` and `.bs-footer` whenever `data-bs-webgl="on"` is present. If you
override those backgrounds in your own CSS with higher specificity, your paint
will sit on top of the GPU surface and you will see both.

## Lifting the content

By default the content does not bend with the surface. To make it bend, pass
the content lift:

```ts
import { contentLift, webglRenderer } from "@surdeddd/bottom-sheet/webgl";

webglRenderer({ lift: contentLift() });
```

When a drag starts, the lift draws the sheet's content into a texture. Nothing
changes on screen yet: a press that does not move the sheet leaves the DOM
alone. Once the sheet moves, the texture takes over from the DOM and the whole
sheet, content included, becomes one deformable surface. `glass` adds a
refraction that rises with the bend. As soon as the sheet is let go and the
bend is flat, the content is handed back to the DOM, a few frames after the
release and while the sheet is still on its way to the snap point.

**What is lifted.** Only what can be reproduced exactly:

- text, drawn line by line where the browser laid it out, with its font,
  colour, `letter-spacing` and `text-transform`;
- backgrounds and borders of one colour, with their corner radii;
- `<img>` content, with `object-fit` of `fill`, `cover` or `contain`.

**What stays in the DOM.** Everything else keeps painting as DOM on top of the
surface, so during a drag it slides with the sheet without bending:

- inputs, buttons, `select`, `textarea`, canvas, video, iframes and SVG;
- an element with a gradient, a background image, a shadow or a border that is
  not the same on all four sides, together with everything inside it;
- text with a shadow, a decoration, a list marker, an ellipsis or a vertical
  writing mode, and an element with generated `::before` or `::after` content;
- anything transformed, filtered, masked, clipped or blended, and anything
  hidden, including text that is clipped away for screen readers only.

If your sheet is mostly form controls, the lift has little to bend; leave it
off.

**Where it is drawn.** The texture is drawn on the pixel grid the browser used
for the DOM. The baseline of every font is measured by the layout engine
itself, through one hidden element that lives for the length of the capture,
and each line is put on the same device pixel row the browser put it on.
Chromium and Firefox count those rows from the sheet's corner, WebKit from the
screen, and the lift follows each.

The scroll container gets a texture of its own. It is clipped to the container,
so rows scrolled out of view never paint over the handle or the header, and it
follows the container's scroll position for as long as the content is lifted.
That matters when something scrolls the list during the drag: with
`fitContentToSnap`, a list scrolled to its very end is held in place while the
sheet expands, and the lifted rows stay exactly where the DOM rows are.

A cross-origin image without CORS headers taints the 2D canvas, and the texture
upload — not the draw — is where that surfaces. The capture is dropped and the
sheet keeps its DOM content undeformed rather than failing.

**With `fitContentToSnap`.** The layout is the same as with the DOM renderer:
at rest the scroll container ends at the visible edge, so a scrollbar stays on
screen, and the footer is pinned to that edge. The pinned footer is not lifted
into the texture; it stays in the DOM and flat while the surface bends. While
the sheet moves it paints the sheet's surface colour, because rows pass behind
it during motion and a transparent footer would show them.

## Known issues

- **Not yet checked across real phones.** The renderer is tested in three
  engines on desktop hardware and in emulated phones. That is the reason it is
  still marked experimental.
- **Under an emulated device pixel ratio, lifted text can sit one device pixel
  off.** Chromium's device toolbar, and the test tools built on it, lay the page
  out in CSS pixels and scale it afterwards, so Chromium rounds every line of
  text to a whole CSS pixel there. The lift rounds to device pixels, as
  Chromium does on a real screen. This shows only while the content is lifted,
  and only in the emulator.
- **In Safari a glyph can differ by a fraction of a pixel.** WebKit places each
  glyph of DOM text on a slightly different sub-pixel than the same glyph on a
  canvas. The lines are on the right rows; single letters can look a touch
  heavier or lighter while lifted.
- **Firefox on a high-density Mac spaces the system font differently on a
  canvas.** DOM text there is tracked for the device pixel size and canvas text
  for the CSS size. The lift fits each line to the width the DOM gave it, so
  the words are in place and the letters inside them are off by a fraction of
  a pixel.
- **Safari hides the renderer's name**, so the check for a software rasteriser
  cannot fire there.

## Options

```ts
webglRenderer({
  jelly: 0.5,
  sheen: 0.35,
  glass: 0.6,
  shadow: 1,
  lift: contentLift(),
  dpr: window.devicePixelRatio,
  allowSoftware: false,
  onUnsupported: reason => console.info("sheet fell back:", reason),
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `jelly` | `0.5` | How far the corners trail behind the middle of the leading edge while the sheet moves. `0` disables the bend; the surface still renders on the GPU. |
| `sheen` | `0.35` | Edge and top-light intensity. `0` gives a flat panel. |
| `glass` | `0.6` | Refraction of the lifted content, scaled by how hard the surface is bending. `0` keeps the texture undistorted. Has no effect without `lift`. |
| `shadow` | `1` | Multiplier on the shadow the shader casts. `0` removes it. |
| `lift` | — | Pass `contentLift()` to draw the content into a texture during a drag so that it bends with the surface. Without it the content stays in the DOM at all times. See [Lifting the content](#lifting-the-content). |
| `dpr` | `devicePixelRatio` | Drawing-buffer scale. Pin it lower (e.g. `1`) to trade sharpness for fill rate on weak GPUs. |
| `allowSoftware` | `false` | Draw even when the browser renders WebGL on the CPU. Off by default, see [Software rasterisers](#software-rasterisers). |
| `onUnsupported` | — | Called with the reason when the renderer declines or withdraws. |

`liftContent`, the boolean this option replaces, is still accepted and no
longer does anything. Up to 0.24.3 the content was lifted unless
`liftContent: false` was set; from 0.24.4 it is lifted only when `lift` is
given.

The bend itself has no options beyond `jelly`. It follows the real position of
the sheet's leading edge like a damped spring, so it answers to how the sheet
moves and not to how far the finger has travelled. The corners trail by at most
22 px outside the sheet and 8 px inside it.

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
while the bend is alive it also draws once per frame from its own loop. The
loop stops once the sheet has settled and the bend is flat. **A resting sheet
costs zero frames**, matching the DOM renderer, and scrolling the page under it
does not redraw it.

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

With `lift`, the capture runs once per gesture, on `dragstart`, and is thrown
away when the content is handed back. It walks the sheet's elements, draws them
into a 2D canvas and uploads it as a texture — one frame's work, not per-frame
work, done while the finger is down and before the sheet has moved. A press
that never becomes a drag pays for the capture and shows nothing of it. A
`MutationObserver` re-takes it if the content changes mid-drag.

Handing the content back repaints its text. Chromium places repainted text by
whether the sheet carries `will-change: transform` at that moment, so the
renderer keeps that hint on the sheet for the one frame of the hand-back when
the engine has already dropped it. Without that, lines could move by a pixel as
they return.

## What is not possible

Refracting **the page behind the sheet** is not achievable this way, and the
renderer does not pretend to: WebGL has no access to the pixels the browser
composited for the rest of the document, and there is no API that hands them
over. `glass` refracts the sheet's own lifted content, which is real
distortion of real pixels. Anything advertising background refraction over
arbitrary DOM is either re-rendering that DOM itself or faking it with a blur.

The design, including this constraint, is written up in
[webgl-renderer-design.md](./webgl-renderer-design.md).
