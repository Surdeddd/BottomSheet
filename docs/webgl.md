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
does not reference it. Measured cost when you do: **2.6 KB gzip**.

## What it draws, and what it does not

The renderer paints the **surface** — the panel, its corner radii, its shadow,
and (from the drag velocity) its deformation. Everything else stays where it
was:

| | handled by |
| --- | --- |
| layout | the DOM, unchanged |
| scrolling and its inertia | the browser's native scroll container |
| pointer gestures | the engine, on the same element |
| focus, roles, screen readers | real DOM nodes |
| text and controls | the DOM, on top of the canvas |

This is deliberate. Text drawn into a texture loses subpixel antialiasing and
cannot be selected, and controls inside a canvas are invisible to assistive
technology. Keeping content in the DOM costs nothing and keeps the sheet's
accessibility contract intact.

While the renderer is active the sheet's chassis stops painting — the library
stylesheet drops the background and shadow of `.bs-sheet`, `.bs-handle`,
`.bs-header` and `.bs-footer` whenever `data-bs-webgl="on"` is present. If you
override those backgrounds in your own CSS with higher specificity, your paint
will sit on top of the GPU surface and you will see both.

## Options

```ts
webglRenderer({
  jelly: 0.6,
  shadow: 1,
  dpr: window.devicePixelRatio,
  onUnsupported: reason => console.info("sheet fell back:", reason),
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `jelly` | `0.5` | How far the surface bends under drag velocity. `0` disables the deformation; the surface still renders on the GPU. |
| `shadow` | `1` | Multiplier on the shadow the shader casts. `0` removes it. |
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

## Roadmap

This is the first of three phases.

1. **Surface on the GPU** — shipped: panel, radii, shadow, velocity bend,
   degradation.
2. **Content from data** — a node schema (`title` / `text` / `row` / `button` /
   `divider`) rendered through a text atlas, so the whole sheet including its
   content can live on the GPU during motion.
3. **Effects** — refraction of the backdrop, specular edge light, and text that
   deforms with the surface while in motion.

The design is written up in
[webgl-renderer-design.md](./webgl-renderer-design.md).
