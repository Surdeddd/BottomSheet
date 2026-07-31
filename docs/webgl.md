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
does not reference it. Measured cost when you do: **4.2 KB gzip**.

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

## Options

```ts
webglRenderer({
  jelly: 0.6,
  sheen: 0.35,
  glass: 0.6,
  shadow: 1,
  liftContent: true,
  dpr: window.devicePixelRatio,
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
| `onUnsupported` | — | Called with the reason when the renderer declines or withdraws. |

## Degradation

The renderer is designed to fail into the DOM renderer, never into a blank
sheet. It declines to install, or removes itself mid-session, when:

| `reason` | When |
| --- | --- |
| `no-document` | server-side rendering — there is no DOM to draw over |
| `no-webgl` | no WebGL context available, or the context failed to initialise |
| `reduced-motion` | the user has `prefers-reduced-motion: reduce` set |
| `context-lost` | the browser dropped the GL context (tab backgrounded, GPU reset, driver crash) |

In every case the sheet's own paint is restored and the canvas is removed. The
sheet keeps working — same snap points, same gestures, same events. Shipping
`webglRenderer()` to a browser without WebGL is safe and silent.

```ts
webglRenderer({
  onUnsupported: reason => {
    if (reason === "context-lost") reportToTelemetry("gpu-drop");
  },
});
```

## Frame budget

The renderer draws only while something moves. It wakes on `dragstart`,
`drag`, `dragend`, `progress` and `snap`, and stops its loop once the sheet has
settled and the deformation has decayed. **A resting sheet costs zero frames**,
matching the DOM renderer.

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

Under SSR the feature never installs — it checks for `document` first — so
hydration is unaffected.

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
