# @surdeddd/bottom-sheet · Web Component

Custom element. Drop into Angular, Solid, Lit, jQuery, plain HTML — anything
that accepts HTML.

## Install

```bash
npm i @surdeddd/bottom-sheet
```

## Usage

```html
<link rel="stylesheet" href="@surdeddd/bottom-sheet/styles" />
<script type="module">
  import "@surdeddd/bottom-sheet/element";
</script>

<bottom-sheet
  snap-points='[{"id":"min","size":96},{"id":"half","size":"45%"},{"id":"full","size":"85%"}]'
  initial="min"
  animation="spring"
  focus-trap="true"
  close-on-escape="true"
>
  <h2 slot="header">Search vehicles</h2>
  <ul>
    <li>…</li>
  </ul>
</bottom-sheet>
```

## Attributes

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `snap-points` | JSON or shorthand | required | `'[{"id":"min","size":96}]'` or `"min:96,half:45%"` |
| `allowed` | comma list | all ids | `"min,half,full"` |
| `initial` | string | first allowed | starting snap id |
| `mode` | enum | `"bottom"` | `bottom \| top \| left \| right` |
| `animation` | enum | `"spring"` | `spring \| tween` |
| `focus-trap` | bool | `false` | `"true"` to enable |
| `close-on-escape` | bool | `true` | set `"false"` to disable |
| `lock-body-scroll` | bool | `true` | set `"false"` for in-page sheets |
| `backdrop` | bool | `true` | set `"false"` to omit backdrop |
| `stylesheet` | url | — | inject a stylesheet into the shadow root |

## Slots

| Slot | Purpose |
| --- | --- |
| `header` | Drag-handle content |
| (default) | Scrollable content |
| `leftButton` / `rightButton` | Docked above the sheet |
| `screen` | Background fading by progress |

## Events

The element dispatches DOM `CustomEvent`s — listen with `addEventListener`:

```js
const sheet = document.querySelector("bottom-sheet");
sheet.addEventListener("snap",     (e) => console.log(e.detail.id, e.detail.size));
sheet.addEventListener("open",     (e) => console.log("opened", e.detail.id));
sheet.addEventListener("close",    ()  => console.log("closed"));
sheet.addEventListener("progress", (e) => console.log(e.detail.value));
```

## Imperative API

```js
const sheet = document.querySelector("bottom-sheet");
await sheet.snapTo("full");
await sheet.open();
await sheet.close();
sheet.setAllowed(["min", "full"], "full");
const { activeId, progress } = sheet.sheetState ?? {};
```

## Custom tag name

```js
import { defineBottomSheet } from "@surdeddd/bottom-sheet/element";
defineBottomSheet("my-sheet"); // registers as <my-sheet>
```

## Stylesheet handoff

The element's Shadow DOM blocks page CSS. Pass an external stylesheet via
the `stylesheet` attribute:

```html
<bottom-sheet stylesheet="/styles.css" snap-points="…">…</bottom-sheet>
```

Or use `::part()` to pierce styling:

```css
bottom-sheet::part(sheet)  { background: #18181b; }
bottom-sheet::part(handle) { padding: 16px; }
```

Available parts: `backdrop`, `screen`, `sheet`, `handle`, `content`,
`left-button`, `right-button`.
