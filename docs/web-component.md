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
| `animation` | enum | `"spring"` | `spring`, `tween`, `ios-spring`, `material-bounce`, `linear`, `snappy` |
| `focus-trap` | bool | `false` | `"true"` to enable |
| `close-on-escape` | bool | `true` | set `"false"` to disable |
| `close-on-route-change` | bool | `false` | close when the URL changes |
| `lock-body-scroll` | bool | `true` | set `"false"` for in-page sheets |
| `backdrop` | bool | `true` | set `"false"` to omit backdrop |
| `stack-effect` | bool | `false` | iOS card-stack scaling of back sheets |
| `persistent` | bool | `false` | block dismissal; programmatic `close()` still works |
| `disable-close` | bool | `false` | block all closing |
| `disable-drag` | bool | `false` | suppress the drag gesture |
| `drag-from` | `handle` \| `sheet` \| `zones` | `handle` | which regions start a drag; `zones` limits it to `[data-bs-drag]` subtrees |
| `drag-from-content` | bool | `true` | whether a touch gesture on the scroll container drags the sheet |
| `radius` | length / px | — | corner radius |
| `max-height` | length / px | — | height cap; a string is re-resolved on viewport changes |
| `snap` | string | — | active snap id — set it to snap imperatively |
| `backdrop-color` / `scrim-color` | color | — | scrim fill color |
| `return-focus-to` | selector | opener | focus target on dismiss |
| `stylesheet` | url | — | inject a stylesheet into the shadow root |
| `sheet-label` | string | `"Bottom sheet"` | accessible name of the dialog |

### Live attributes (no re-init)

`radius`, `max-height`, `backdrop-color`, `scrim-color`, `snap`, `persistent`,
`disable-close`, `disable-drag`, `drag-from` and `drag-from-content` apply in place — changing them mutates the
running engine without tearing it down. Any other observed attribute triggers a
re-init. The active snap survives DOM moves and structural re-inits: if the
current snap id still exists in the new `snap-points`, the element re-opens at
it instead of the `initial` attribute.

## Slots

| Slot | Purpose |
| --- | --- |
| `header` | Header content |
| (default) | Scrollable content |
| `footer` | Footer content, pinned below the scroll area |
| `leftButton` / `rightButton` | Docked above the sheet |
| `screen` | Background fading by progress |
| `anchor` | Anchored elements riding the sheet (see below) |

## Anchored elements

Any light-DOM child with `slot="anchor"` becomes an anchor — it is moved into
a fixed wrapper that rides the sheet edge:

```html
<bottom-sheet snap-points="min:96,full:85%">
  <button
    slot="anchor"
    data-position="sheet-top-right"
    data-show-on="full"
    data-animation="pop"
  >
    ✕
  </button>
  <nav slot="anchor" data-position="dock-bottom">…tab bar…</nav>
  <p>content…</p>
</bottom-sheet>
```

Supported data attributes: `data-position` (12 positions plus
`dock-bottom | dock-top`), `data-show-on` (comma list of snap ids),
`data-animation` (`fade | scale | slide | pop | none`), `data-inset`,
`data-fade-range="0.4,1"`, `data-interactive="false"`. The element-level
`addAnchor()` / `setScrimStages()` methods mirror the
[engine API](anchors.md).

## Events

The element dispatches DOM `CustomEvent`s — listen with `addEventListener`:

```js
const sheet = document.querySelector("bottom-sheet");
sheet.addEventListener("snap",     (e) => console.log(e.detail.id, e.detail.size));
sheet.addEventListener("open",     (e) => console.log("opening", e.detail.id));
sheet.addEventListener("opened",   (e) => console.log("open settled", e.detail.id));
sheet.addEventListener("close",    ()  => console.log("closing"));
sheet.addEventListener("closed",   ()  => console.log("close settled"));
sheet.addEventListener("progress", (e) => console.log(e.detail.value));
sheet.addEventListener("drag-start", (e) => console.log(e.detail.size));
sheet.addEventListener("drag",       (e) => console.log(e.detail.size, e.detail.delta));
sheet.addEventListener("drag-end",   (e) => console.log(e.detail.velocity));
```

Full event set: `snap`, `before-snap`, `open`, `opened`, `close`, `closed`,
`before-close`, `progress`, `drag-start`, `drag`, `drag-end`.

### Cancelable events

`before-snap` and `before-close` are cancelable — call `e.preventDefault()` to
veto the transition (the element translates that into the engine's synchronous
`cancel()`):

```js
sheet.addEventListener("before-close", (e) => {
  if (formDirty) e.preventDefault(); // keep the sheet open
});
```

## Imperative API

```js
const sheet = document.querySelector("bottom-sheet");
await sheet.snapTo("full");
await sheet.open();
await sheet.close();          // close(reason?)
await sheet.expand();         // largest allowed snap
await sheet.collapse();       // smallest allowed snap > 0
sheet.setAllowed(["min", "full"], "full");
sheet.setRadius("28px");
sheet.setMaxHeight("92dvh");
sheet.recompute();            // re-measure a 'fit' / 'content' snap
sheet.isTop();                // top of the multi-sheet stack?
sheet.depth();                // open sheets above this one
sheet.canDismiss();           // false when persistent / disable-close
sheet.snap = "half";          // property setter — snaps imperatively
const { activeId, progress } = sheet.sheetState ?? {};
const engine = sheet.getEngine(); // full engine for anything else
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

Available parts: `backdrop`, `screen`, `sheet`, `handle`, `header`, `content`,
`footer`, `left-button`, `right-button`.
