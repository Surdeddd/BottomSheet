# Anchored elements & scrim stages

Two engine-level primitives for building UI that lives *around* the sheet:
**anchors** pin arbitrary elements to the sheet edge (or the screen) and ride
its motion on the compositor; **scrim stages** swap scrim content per sheet
state. Both are zero-JS-per-frame: position rides the `--bs-size` /
`--bs-progress` CSS variables the engine already writes, visibility and
content swaps happen only on snap events.

## Anchors — `engine.addAnchor(opts)`

```ts
const detach = engine.addAnchor({
  element: myButton,            // any HTMLElement — moved into a fixed wrapper
  position: "sheet-top-right",  // 3 sheet-anchored + 9 screen positions
  inset: "16px",
  showOn: ["half", "full"],     // snap ids, or a predicate:
  // showOn: state => state.size > 200,
  fadeRange: [0.4, 1],          // optional CSS-only opacity from --bs-progress
  interactive: true,            // pointer-events (auto while visible)
  animation: "pop",             // enter/exit transition, see below
});
detach();                       // remove; engine.destroy() also cleans up
```

- `position` — `sheet-top-left | sheet-top-center | sheet-top-right` ride the
  sheet edge via `calc(var(--bs-size) + inset)`; the nine screen positions
  (`top-left` … `bottom-right`) are viewport-fixed; `dock-bottom | dock-top`
  are full-width viewport-edge bars (see below).
- `showOn` omitted → visible whenever the sheet is open (`size > 0`). An array
  matches the settled snap id (include your closed id to keep it visible while
  closed). A predicate gets `{ activeId, size, progress }`.
- `fadeRange: [from, to]` binds wrapper opacity to `--bs-progress` in pure
  CSS — it composes with enter/exit animations (wrapper fades, element
  animates).
- Anchors stack with the sheet: z-index is always `sheet z + 1`, and follows
  the multi-sheet stack.

## Docked bars — `position: "dock-bottom" | "dock-top"`

The tab-bar pattern: a full-width bar pinned to the viewport edge that the
sheet slides **under** (the bar renders above the sheet by default, like a
native bottom navigation):

```ts
engine.addAnchor({
  element: tabBar,
  position: "dock-bottom",
  animation: "slide",
});
```

- spans the full viewport width (`left/right: 0`), ignores `inset`;
- visible **always** by default — including while the sheet is closed; narrow
  it with `showOn` as usual;
- z-index is `sheet z + 1`, so the sheet and its content scroll behind the
  bar. Give your scroll container bottom padding equal to the bar height if
  the last items must not end underneath it.

## Stacked sheets — `stackEffect: true`

Multiple engines stack automatically (z-index, top-of-stack Escape, the top
sheet's backdrop dims everything below — including the sheets behind it).
`stackEffect` adds the iOS card-deck look: each sheet behind the top one
scales down by 4% per depth level (floor 0.86), animated via the independent
CSS `scale` property so it never fights the per-frame `transform` writes.
Every sheet also carries `data-stack-depth="0|1|2…"` — style it yourself if
you want a different effect:

```css
.bs-sheet[data-stack-depth="1"] { filter: brightness(0.9); }
```

Web component: `<bottom-sheet stack-effect="true">`.

## Animations — shared spec

Used by anchors, scrim stages (`animation` option):

```ts
type AnchorAnimationSpec =
  | "fade" | "scale" | "slide" | "pop" | "none"     // presets
  | {
      preset?: "fade" | "scale" | "slide" | "pop";
      enter?: Keyframe[];                            // fully custom WAAPI keyframes
      exit?: Keyframe[];
      duration?: number;                             // default 200 (ms)
      easing?: string;                               // default cubic-bezier(0.22, 1, 0.36, 1)
      respectReducedMotion?: boolean;                // default true
    };
```

```ts
engine.addAnchor({
  element: badge,
  animation: {
    enter: [
      { opacity: 0, transform: "translateY(16px) rotate(-6deg)" },
      { opacity: 1, transform: "translateY(0) rotate(0)" },
    ],
    exit: [{ opacity: 1 }, { opacity: 0 }],
    duration: 280,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
});
```

Runs on the Web Animations API (compositor-friendly opacity/transform),
falls back to instant toggling where WAAPI is unavailable, and honors
`prefers-reduced-motion` unless opted out.

## Scrim stages — `engine.setScrimStages(opts)`

State-driven scrim content: per snap id and/or progress range.

```ts
engine.setScrimStages({
  position: "center",            // shared default, per-stage override allowed
  inset: "16px",
  animation: "fade",             // shared default, per-stage override allowed
  stages: [
    { for: "peek", element: teaserImg },
    { for: ["half", "full"], element: promoCard, position: "top-center" },
    { forRange: [0, 0.5], element: hintBadge },   // progress-bound
  ],
});
engine.setScrimStages(null);     // remove
```

- `for` (id match) wins over `forRange`; first match is active.
- Range stages re-evaluate during drag (cheap number compare per progress
  event); transitions only fire on actual stage changes.
- When the sheet is closed only `for`-stages matching the closed id show.
- Requires a `scrim` element on the engine.

## Adapters

**React** — declarative props (portals keep React rendering the content):

```tsx
<BottomSheet
  anchors={[
    { position: "sheet-top-right", showOn: ["half", "full"], animation: "pop",
      node: <CloseButton /> },
  ]}
  scrimStages={{
    animation: "scale",
    stages: [
      { for: "peek", node: <Teaser /> },
      { forRange: [0.5, 1], node: <Expanded /> },
    ],
  }}
  ...
/>
```

Both are also available on the imperative handle: `ref.current.addAnchor(...)`,
`ref.current.setScrimStages(...)`.

**Vue** — via the composable / component expose:

```ts
const { addAnchor, setScrimStages } = useBottomSheet({ ... });
addAnchor({ element: btnEl.value!, position: "sheet-top-center" });
```

**Svelte** — on the controller:

```ts
const ctrl = createBottomSheet({ ... });
ctrl.addAnchor({ element: btnEl, showOn: ["full"] });
ctrl.setScrimStages({ stages: [...] });
```

**Web Component** — declarative slot + methods:

```html
<bottom-sheet snap-points='[...]'>
  <button
    slot="anchor"
    data-position="sheet-top-right"
    data-show-on="half,full"
    data-animation="pop"
    data-inset="14px"
  >
    Close
  </button>
  <p>content…</p>
</bottom-sheet>
```

`data-fade-range="0.4,1"` and `data-interactive="false"` are also supported;
`el.addAnchor(...)` / `el.setScrimStages(...)` mirror the engine API.
