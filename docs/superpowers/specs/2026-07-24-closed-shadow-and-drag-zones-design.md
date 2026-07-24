# Closed-sheet shadow hardening + drag zones — design

Date: 2026-07-24
Status: approved, ready for implementation

## Problem

### 1. Closed sheets paint a shadow band

A closed sheet stays mounted and is hidden purely by `transform: translate3d(0, cap, 0)`
(`BottomSheetCore.applySize`). `box-shadow` is not clipped by a transform, and the sheet's top
edge rests exactly on the viewport's bottom edge, so the whole upward shadow (offset + blur)
paints inside the viewport. On a screen with ~10 pre-mounted closed sheets those shadows stack
into a visible dark band above the tab bar.

`--bs-shadow-auto` never reaches zero — at `--bs-progress: 0` it evaluates to
`0 -3px 12px rgba(0,0,0,0.12)`. A user-supplied `--bs-shadow` is worse: it is not
progress-driven at all, so it paints at full strength while closed.

### 2. Content scrolling collapses the sheet

Two independent drag sources exist and neither can be scoped:

- `this.handle = opts.handle ?? opts.element` — with no handle the entire sheet is draggable.
- `content-swipe` (default feature) snaps to the neighbouring snap point after a 60px touch
  swipe on the scroll container, including into `closed`.

There is no way to say "this region drags, that one doesn't" or "from this snap point the
content only scrolls".

## Solution

### A. Shadow

Two layers, both required.

**A1 — CSS reaches a true zero.** Multiply only the shadow's alpha by a fast fade factor:

```css
--bs-shadow-fade: clamp(0, calc(var(--bs-progress, 0) * 8), 1);
```

At `progress = 1` the resolved shadow is byte-identical to today's; the alpha only decays over
the last 12.5% of travel, where the sheet is already off-screen. Applied to all four modes
(`top`/`left`/`right` currently use static values and have the same defect).

**A2 — rest attribute covers custom shadows.** The core sets `data-bs-rest="closed"` on the
sheet element when `size === 0` with no drag or animation in flight, and removes it when a new
cycle starts. CSS:

```css
.bs-sheet[data-bs-rest="closed"] { box-shadow: none; visibility: hidden; }
```

`visibility: hidden` preserves layout (so `fit`/`content` measurement via `scrollHeight` keeps
working) while removing the sheet from hit-testing and the accessibility tree.

Write points: constructor (after the initial `applySize`), `completeSnap` (set when
`targetSize === 0`), `applySize` (clear as soon as the size leaves zero), `destroy` (clear so
the element is left usable). Clearing in `newCycle()` was tried first and is wrong — a resize
or visual-viewport cycle drops the mark on a sheet that never opens, and it never returns.

### B. Drag control — three orthogonal axes

**B1 — `dragFrom`: which regions outside the scroll container start a drag.**

```ts
dragFrom?: "handle" | "sheet" | "zones";  // default: opts.handle ? "handle" : "sheet"
```

**B2 — DOM zones.** `[data-bs-drag]` opts a subtree in (meaningful under `"zones"`),
`[data-bs-no-drag]` opts a subtree out (honoured in every mode). Resolved with
`target.closest()` by a pure helper in `src/core/primitives/drag-zones.ts`.

**B3 — per-snap-point content rule.**

```ts
snapPoints: [
  { id: "closed", size: 0 },
  { id: "half",   size: "45%" },
  { id: "full",   size: "92%", dragFromContent: false },
]
```

Plus a global `dragFromContent?: boolean` in `EngineOptions` acting as the default for every
point. The rule is read from the *active* snap point when the gesture starts.

Axis split: `dragFrom` governs the sheet outside the scroll container, `dragFromContent`
governs the scroll container itself. They never overlap.

### C. Follow-the-finger drag from content

The threshold swipe is replaced by a real drag that tracks the finger. No second physics
implementation: the core exposes a narrow seam

```ts
// EngineFeatureContext
attachDragSurface: (surface: HTMLElement, kind: "content") => (() => void) | void;
```

which mounts a second `GestureController` on the scroll container with the same deps as the
handle controller — same rubber band, same `settleAfterDrag`, same `drag`/`dragend` events.
The `content-swipe` feature shrinks to "here is the scroll container, it is a content surface";
all gating lives in the core.

`installGestures` gains two options:

- `manageTouchAction: false` — never write `touch-action` on a scroll container.
- `deferStart(e, delta) => boolean | null` — called on `pointermove` while the gesture is
  pending: `true` confirms the drag (capture + `onStart`), `false` releases it to the browser,
  `null` keeps waiting. Absent ⇒ today's behaviour (start on `pointerdown`).

Direction decision is a pure function:

```ts
decideContentGesture({ delta, scrollTop, atMaxSnap, slop }) -> "drag" | "scroll" | "pending"
```

- pulling the sheet down while `scrollTop <= 0` → drag
- pulling up while not at the largest allowed snap → drag
- otherwise → scroll

Native scrolling is suppressed by a non-passive `touchmove` listener
(`primitives/touch-scroll-guard.ts`) that calls `preventDefault()` once the drag is confirmed.
This is load-bearing, not a nicety: measured in Chromium, a scroll-capable container emits
exactly one `pointermove` and then `pointercancel` — without the `preventDefault` on that
first `touchmove`, the pointer stream dies and the drag is cancelled mid-gesture.

`[data-bs-no-drag]` is honoured on the content surface too, so a carousel inside the sheet
keeps its own gesture.

Mutual exclusion: a surface refuses to start while another surface owns the drag.

## Compatibility

Every new option is optional and defaults to current behaviour. The one intentional behavioural
change is that content gestures become follow-the-finger instead of a 60px threshold jump —
a minor, documented change. The `content-swipe` feature keeps its registry name.

## Verification

- Unit: drag-zone matrix (`target` × `dragFrom`), `decideContentGesture` truth table, rest
  attribute lifecycle, per-point resolution, option plumbing.
- E2E (Playwright, full suite): content drag moves the sheet, long-content scrolling never
  collapses it, `dragFromContent: false` disables the gesture, `[data-bs-no-drag]` region does
  not drag, closed-sheet shadow band gone (visual snapshots).
- `baseStyles.ts` regenerated via `npm run sync:css`; `tsc --noEmit`, eslint, `vitest run`,
  size-limit.

## Implementation order

1. CSS shadow fade + rest rule; regenerate `baseStyles.ts`.
2. Core rest attribute + unit tests.
3. `drag-zones.ts` + `dragFrom` option, wired into the handle gesture.
4. `installGestures` options (`shouldStart`, `deferStart`, `manageTouchAction`).
5. `attachDragSurface` seam + content drag controller + `dragFromContent` gating.
6. Rewrite the `content-swipe` feature onto the seam.
7. Adapter plumbing (react/vue/svelte/solid/qwik/preact/web-component + `.d.ts` templates).
8. Docs + CHANGELOG.
9. Full verification run.
