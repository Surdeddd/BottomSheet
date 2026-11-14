# Theming

Everything visual is a CSS custom property. Set the properties on `.bs-root`,
on any ancestor, or on `:root`. They inherit through the custom element's
shadow boundary, so the same rule styles every adapter.

```css
.bs-root {
  --bs-surface: #18181b;
  --bs-radius: 28px;
  --bs-handle-color: #71717a;
  --bs-backdrop-color: rgb(0 0 0 / 0.6);
}
```

## Tokens

Surface

| Token | Default | What it styles |
| --- | --- | --- |
| `--bs-surface` | `#ffffff`, `#1a1a1d` in dark mode | Sheet, header and footer background |
| `--bs-surface-border` | a hairline | Border on the sheet's free edge and above the footer |
| `--bs-radius` | `20px` | Corners on the sheet's free edge |
| `--bs-shadow` | a soft shadow that grows as the sheet rises | Shadow of the sheet |

Handle

| Token | Default | What it styles |
| --- | --- | --- |
| `--bs-handle-color` | 30% ink | The grabber bar |
| `--bs-handle-width`, `--bs-handle-height` | `40px`, `5px` | Its size |
| `--bs-handle-padding` | `8px 16px 4px` | The strip around it, which is the drag target |

Layout

| Token | Default | What it styles |
| --- | --- | --- |
| `--bs-content-padding` | `0 16px 16px` | The scroll area |
| `--bs-header-padding` | `0 16px 8px` | The header |
| `--bs-header-min-height` | `0px` | The header's minimum height |
| `--bs-footer-padding` | `12px 16px calc(12px + env(safe-area-inset-bottom))` | The footer; the default clears the home indicator |

Set a padding to `0` for content that runs edge to edge.

Dim layers

| Token | Default | What it styles |
| --- | --- | --- |
| `--bs-backdrop-color` | `rgb(0 0 0 / 0.5)` | The backdrop |
| `--bs-scrim-color` | transparent | The scrim layer |
| `--bs-scrim-blur` | `0px` | `backdrop-filter: blur()` on the scrim layer |

The engine writes a few properties itself, for you to read:

| Property | Value |
| --- | --- |
| `--bs-size` | The sheet's size in pixels |
| `--bs-progress` | 0 at the smallest allowed point, 1 at the largest |
| `--bs-keyboard-inset` | How much of the screen the on-screen keyboard covers |

They are set on the sheet and on `.bs-root` on every frame, so anything inside
the root can follow the sheet without JavaScript:

```css
.bs-root .fab {
  bottom: calc(var(--bs-size) + 16px);
  scale: calc(1 - var(--bs-progress) * 0.2);
}
```

## Dark mode

The default surface follows `prefers-color-scheme`. To follow a switch of your
own, set the tokens under your own selector:

```css
[data-theme="dark"] .bs-root {
  --bs-surface: #111113;
  --bs-handle-color: rgb(255 255 255 / 0.4);
}
```

## Ready-made themes

Three looks ship as separate stylesheets:

```ts
import "@surdeddd/bottom-sheet/styles";
import "@surdeddd/bottom-sheet/themes/ios";
```

```html
<div class="bs-theme-ios">
  <!-- the sheet -->
</div>
```

| Import | Class | Look |
| --- | --- | --- |
| `/themes/ios` | `bs-theme-ios` | Grey surface, 14px corners, blurred scrim |
| `/themes/material` | `bs-theme-material` | Tinted surface, 28px corners |
| `/themes/vercel` | `bs-theme-vercel` | White, 8px corners, hairline border |

Put the class on `.bs-root` or on any ancestor. Each theme has a dark variant
that applies under an ancestor with `data-theme="dark"`.

In React, `className` goes on the sheet element, which is inside `.bs-root`.
Put the theme class on a wrapper instead.

## The backdrop

The backdrop dims the page and takes the tap that closes the sheet. Its colour
is `--bs-backdrop-color`, or the `backdropColor` option. Its opacity follows
the sheet:

- `backdropRange: [0.4, 1]` keeps the page clear until the sheet is 40% of the
  way up, then fades the backdrop in over the rest.
- `backdropOpacity: 0.6` is the opacity it reaches at the end of that range.

Each sheet in a stack has its own backdrop, so the dimming deepens with every
level. For a single level, switch the backdrop off on the sheets that open on
top (`backdrop={false}`).

## The scrim

The scrim is a second layer, between the backdrop and the sheet. It holds
content that belongs behind the sheet, such as a map preview, and it can
carry a colour and a blur of its own. In the components it is the `screen`
prop or slot.

| Option | What it does |
| --- | --- |
| `scrimMode` | `full` covers the screen, `above-sheet` stops at the sheet's edge, `off` removes the layer |
| `scrimPreset` | `subtle`, `standard`, `monitoring` or `cinematic`: a colour, a blur and a range in one |
| `scrimColor`, `scrimBlur` | Fill and blur radius |
| `screenRange` | The stretch of `progress` over which the layer fades in |
| `scrimInteractive` | Let the layer take pointer input. Off by default: input passes through to the page |
| `scrimTapToClose` | A tap on the layer closes the sheet |

All of it can change on a running sheet:

```ts
sheet.setScrim({ preset: "cinematic", tapToClose: true });
sheet.setScrimMode("above-sheet");
sheet.setScrimColor("rgb(15 15 20 / 0.55)");
sheet.setScrimBlur("8px");
sheet.setScreenRange([0.5, 1]);
sheet.setScrimEnabled(false);
sheet.getScrimState();
```

`setScrimOverlay({ children, position, inset, interactive })` puts one element
of yours into the scrim, at one of nine screen positions or riding the sheet's
edge, and returns a function that removes it. For several elements that come
and go with the snap points, use
[anchors and scrim stages](anchors.md).

## Stacking

The engine owns `z-index`. It writes it inline on the sheet, the backdrop and
the anchors every time the stack changes, starting at 100 and adding 10 per
level, so a value of yours is overwritten.

To place the sheets against the rest of the app, move them instead: give
`teleportTo` a container with the stacking context you want, or put `.bs-root`
inside one.

## The custom element

Tokens work on the element as they do anywhere else. For what a token does
not reach, the element exposes parts:

```css
bottom-sheet::part(sheet) { box-shadow: 0 -8px 40px rgb(0 0 0 / 0.4); }
bottom-sheet::part(handle) { padding: 16px; }
```

`sheet`, `handle`, `header`, `content`, `footer`, `backdrop`, `screen`,
`left-button`, `right-button`. The `stylesheet` attribute loads a whole
stylesheet into the shadow root.

## Accessibility of the look

- Under `prefers-reduced-motion: reduce` the sheet jumps to its point and the
  stylesheet drops its transitions. `respectReducedMotion: false` opts out.
- Under `forced-colors: active` the sheet gets a border, and the handle and
  the focus ring use system colours.
- The handle shows a focus ring for keyboard users only.
