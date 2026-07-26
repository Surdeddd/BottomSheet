# Browser support

The floor is set by what the engine cannot work without: Pointer Events, CSS
custom properties, and ES2020 syntax (the build target). Everything else in the
list below degrades rather than breaks.

## Baseline

| Browser | Minimum | Set by |
| --- | --- | --- |
| Chrome / Edge | 80 | ES2020 build target |
| Safari (macOS) | 13.1 | ES2020, `ResizeObserver` |
| Safari (iOS) | 13.4 | ES2020, Pointer Events |
| Firefox | 72 | ES2020 build target |
| Samsung Internet | 13 | tracks Chromium 79-80 |

The package ships ESM and CJS at `target: es2020` and is not transpiled below
that. A consumer whose own build targets older browsers must run the package
through their transpiler — it is plain JavaScript with no syntax the tooling
cannot lower, but the shipped artifact will not do it for you.

There is no IE11 story and there will not be one: Pointer Events and custom
properties are both load-bearing.

## Required

Without these the sheet does not function.

| Feature | Chrome | Safari | Firefox | Used for |
| --- | --- | --- | --- | --- |
| Pointer Events | 55 | 13 | 59 | every gesture |
| CSS custom properties | 49 | 9.1 | 31 | size, progress, theming |
| `ResizeObserver` | 64 | 13.1 | 69 | content-sized snap points, reflow |
| `requestAnimationFrame` | 24 | 6.1 | 23 | the animation loop |
| `MutationObserver` | 26 | 7 | 14 | content and attribute tracking |

## Progressive

Present or absent, the sheet works; these change what it can do.

| Feature | Chrome | Safari | Firefox | Absent means |
| --- | --- | --- | --- | --- |
| `inert` | 102 | 15.5 | 112 | background stays reachable by tab and screen reader while the sheet is modal — the focus trap still holds focus, but siblings are not silenced |
| Web Animations API | 84 | 13.1 | 75 | `settleAnimation: "waapi"` falls back to the rAF spring; identical motion, one less compositor hand-off |
| `visualViewport` | 61 | 13 | 91 | the sheet does not follow the on-screen keyboard |
| `backdrop-filter` | 76 | 9 `-webkit-` | 103 | scrim blur is skipped; the dim layer still renders |
| `:has()` | 105 | 15.4 | 121 | an empty header or footer occupies its slot instead of collapsing |
| `color-mix()` | 111 | 16.2 | 113 | the handle does not shade on hover and press |
| `env(safe-area-inset-*)` | 69 | 11.2 | 65 | no automatic inset for the home indicator and notch |
| `navigator.vibrate` | 32 | — | 16 | `haptic: true` is a no-op (Safari has no Vibration API) |
| `IntersectionObserver` | 51 | 12.1 | 55 | a sheet born inside a hidden ancestor does not self-heal on reveal |
| WebGL | 9 | 5.1 | 4 | `webglRenderer()` removes itself and the DOM renderer draws |

Every one of these is capability-checked at runtime — the library never assumes
a version.

## Adapters

Framework support follows each framework's own baseline, which is at or above
the library's:

| Adapter | Peer range | Note |
| --- | --- | --- |
| React / Preact | `react >=18`, `preact >=10` | 18 is a hard floor — the hook reads state through `useSyncExternalStore` |
| Vue | `vue >=3.2` | |
| Svelte | `svelte >=5` | runes |
| Solid | `solid-js >=1` | |
| Qwik | `@builder.io/qwik >=1` | |
| Custom element | — | `customElements` and Shadow DOM v1: Chrome 54, Safari 10.1, Firefox 63 |

## Server rendering

The package is SSR-safe: nothing touches `window`, `document`, or `navigator`
at module scope, and every adapter renders static markup on the server, wiring
gestures on mount. `@surdeddd/bottom-sheet/qwik` ships a resumable build
verified in CI by a full client + SSR consumer contract.

## What is verified, and what is not

CI runs the full E2E suite on Chromium, WebKit, and Firefox at every push,
across six viewports from 320 px up. Those three engines are the tested
contract.

The version numbers above come from the APIs the source actually calls, not
from a support matrix generator. Old-version claims — Chrome 80, Safari 13.4 —
are read off the build target and API list; they are not exercised by a device
lab. If you hit a real failure on a browser at or above the baseline, that is a
bug worth filing.
