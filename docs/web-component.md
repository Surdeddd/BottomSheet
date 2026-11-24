# Custom element

`<bottom-sheet>` is a custom element with the engine and its styles inside. It
works wherever HTML does: Angular, Lit, Astro, a server-rendered page, a plain
file.

```bash
npm i @surdeddd/bottom-sheet
```

## A modal sheet

```html
<script type="module">
  import "@surdeddd/bottom-sheet/element";
</script>

<button id="filters">Filters</button>

<bottom-sheet snap-points="closed:0,open:fit" focus-trap="true">
  <h2 slot="header">Filters</h2>
  <form>…</form>
  <button slot="footer">Apply</button>
</bottom-sheet>

<script type="module">
  const sheet = document.querySelector("bottom-sheet");
  document.querySelector("#filters").addEventListener("click", () => sheet.open());
</script>
```

Importing the module registers `<bottom-sheet>`. The styles live in the
element's shadow root, so there is no stylesheet to add.

The element also has an `open` attribute, like `<details>`: it is there while
the sheet is showing, and adding or removing it opens or closes the sheet.

```js
sheet.toggleAttribute("open", true);
```

Without a bundler, use the CDN build:

```html
<script src="https://unpkg.com/@surdeddd/bottom-sheet/dist/element.iife.global.js"></script>
```

## Attributes

| Attribute | Default | What it does |
| --- | --- | --- |
| `snap-points` | one `full` point | `"min:96,half:45%,full:90%"`, or the JSON form `'[{"id":"min","size":96}]'` |
| `allowed` | all ids | Comma list of the points the sheet may rest at |
| `initial` | first allowed | The point to start at |
| `snap` | none | The active point. Set it to move the sheet. At creation it wins over `initial` |
| `open` | reflects the sheet | Present while the sheet is showing. `open="false"` at creation starts it closed |
| `mode` | `bottom` | `bottom`, `top`, `left`, `right`, `start`, `end` |
| `animation` | `spring` | `spring`, `ios-spring`, `material-bounce`, `snappy`, `tween`, `linear` |
| `focus-trap` | `false` | `"true"` keeps Tab inside the sheet |
| `close-on-escape` | `true` | `"false"` to switch off |
| `close-on-route-change` | `false` | Close when the URL changes |
| `lock-body-scroll` | `true` | `"false"` for a sheet that leaves the page scrollable |
| `backdrop` | `true` | `"false"` to leave the backdrop out |
| `backdrop-color` | stylesheet | Colour of the backdrop |
| `scrim-color` | none | Fill of the scrim layer |
| `persistent` | `false` | The user cannot dismiss the sheet; `close()` still works |
| `disable-close` | `false` | Nothing closes the sheet |
| `disable-drag` | `false` | Switch the gesture off |
| `drag-from` | `handle` | `handle`, `sheet`, or `zones` for `[data-bs-drag]` subtrees only |
| `drag-from-content` | `true` | Whether a touch on the scroll area drags the sheet |
| `fit-content-to-snap` | `false` | [Keep the whole scroll area reachable](content-fit.md) at every point |
| `stack-effect` | `false` | Scale the sheets behind the top one |
| `radius` | `20px` | Corner radius |
| `max-height` | none | Cap on the sheet's size |
| `return-focus-to` | the opener | Selector of the element to focus on close |
| `sheet-label` | `"Bottom sheet"` | Accessible name of the sheet |
| `handle-label`, `content-label` | English | Accessible names of the handle and the scroll area |
| `stylesheet` | none | URL of a stylesheet to load into the shadow root |
| `options` | none | Any other [engine option](../README.md#options), as JSON |

`mode`, `snap`, `open`, `radius`, `max-height`, `backdrop-color`,
`scrim-color`, `persistent`, `disable-close`, `disable-drag`, `drag-from`,
`drag-from-content`, `handle-label` and `content-label` are applied to the
running sheet. Changing any other attribute rebuilds the engine; the sheet
stays at its current point if that point still exists.

### Every other option

The attributes cover the common options. The rest go through `options`:

```html
<bottom-sheet
  snap-points="closed:0,open:fit"
  options='{"closeOnBack":true,"inertSiblings":true,"scrimPreset":"cinematic"}'
></bottom-sheet>
```

For values JSON cannot hold, such as an `easing` function, set the property:

```js
sheet.options = { easing: t => t * t, autoCollapseAfter: 8000 };
```

An attribute wins over the same key in `options`.

## Slots

| Slot | What goes in it |
| --- | --- |
| default | The scroll area |
| `header`, `footer` | Regions above and below the scroll area. An empty one is hidden |
| `leftButton`, `rightButton` | Buttons that float above the sheet's leading edge |
| `screen` | Content of the scrim layer; fades in with `progress` |
| `anchor` | An [anchored element](#anchored-elements) |

## Events

```js
sheet.addEventListener("snap", event => console.log(event.detail.id));
sheet.addEventListener("closed", () => sheet.remove());
```

| Event | `detail` | When |
| --- | --- | --- |
| `snap` | `{ id, size, progress }` | The sheet settled on a point |
| `open`, `opened` | `{ id }` | It starts to appear; it has landed |
| `close`, `closed` | none | It starts to leave; it is gone |
| `before-snap` | `{ id, size, previousId }` | Before a move. Cancelable |
| `before-close` | `{ reason }` | Before a close. Cancelable |
| `drag-start`, `drag-end` | `{ size }`, `{ size, velocity }` | A drag begins and ends |
| `drag`, `progress` | `{ size, delta }`, `{ value, size }` | Every frame of a drag; every frame of any motion |

Stop a move with `preventDefault()`:

```js
sheet.addEventListener("before-close", event => {
  if (form.dirty) event.preventDefault();
});
```

## Methods and properties

```js
await sheet.open();
await sheet.close();
await sheet.snapTo("full");
await sheet.expand();
await sheet.collapse();

sheet.setAllowed(["half", "full"]);
sheet.setMode("right");
sheet.setRadius("28px");
sheet.setMaxHeight("92dvh");
sheet.recompute();

sheet.snap = "half";
sheet.snap;
sheet.sheetState;
sheet.isTop();
sheet.depth();
sheet.canDismiss();
sheet.getEngine();
```

`sheetState` is the engine's `{ activeId, activeLabel, size, progress, phase,
isDragging, isAnimating }`. `getEngine()` returns the engine for everything else.

In TypeScript, `TypedBottomSheetElement<"half" | "full">` types the element
and its snap ids.

## Anchored elements

A child with `slot="anchor"` rides the sheet's edge or stays fixed to the
screen. It remains your element in your DOM, so your CSS styles it:

```html
<bottom-sheet snap-points="min:96,full:90%">
  <button slot="anchor" data-position="sheet-top-right" data-show-on="full" data-animation="pop">
    Close
  </button>
  <nav slot="anchor" data-position="dock-bottom">…</nav>
  <p>…</p>
</bottom-sheet>
```

`data-position`, `data-show-on` (comma list of snap ids), `data-animation`
(`fade`, `scale`, `slide`, `pop`, `none`), `data-inset`,
`data-fade-range="0.4,1"` and `data-interactive="false"` take the same values
as the [`addAnchor()` options](anchors.md).

## Styling

Custom properties cross the shadow boundary, so the tokens work as they do
everywhere else:

```css
bottom-sheet {
  --bs-surface: #18181b;
  --bs-radius: 28px;
}
```

For anything a token does not cover, style the parts:

```css
bottom-sheet::part(sheet) { box-shadow: 0 -8px 40px rgb(0 0 0 / 0.4); }
bottom-sheet::part(handle) { padding: 16px; }
```

The parts are `sheet`, `handle`, `header`, `content`, `footer`, `backdrop`,
`screen`, `left-button` and `right-button`. [All tokens →](theming.md)

## Another tag name

```js
import { defineBottomSheet } from "@surdeddd/bottom-sheet/element";

defineBottomSheet("app-sheet");
```
