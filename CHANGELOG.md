# Changelog

All notable changes to `@surdeddd/bottom-sheet` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Safari honours `user-select` on the sheet** — the stylesheet set `user-select` without the `-webkit-` prefix, and Safari listens only to the prefixed property. The handle and the header of a sheet could be selected there. The prefixed property is set next to each one.
- **A mouse drag of the sheet selects nothing in Safari** — Safari lets a selection begin inside an element that cannot be selected, so a drag that started on the handle selected whatever the pointer passed over: the content of a sheet docked to a side, or the text of the page once the pointer ran past the sheet. A press that drags the sheet now refuses the selection from its first move on. A press that has not moved still places a caret and selects a word on a double click.
- **The browser's own drag does not take a drag of the sheet away** — a press on a link inside the handle, or inside any part that drags the sheet, started the browser's drag of that link after a few pixels. Chrome and Firefox cancelled the pointer and the sheet went back to where it was. A press that drags the sheet now cancels the native drag, and the sheet moves. An element that has to keep its own drag takes `data-bs-no-drag`.
- **A sheet docked to a side bends under the WebGL renderer** — the rule that makes the handle transparent while the renderer draws the surface lost to the rule that paints the handle of a left or right sheet, which has the same specificity and comes later. The handle stayed painted by the DOM, on top of the canvas, and hid the bend of the leading edge.
- **A selection does not tint the WebGL surface in Safari** — the canvas could be selected like an image. Select everything on the page, or drag with a mouse so that Safari starts an empty selection across the sheet, and the whole surface was covered by the selection highlight. The canvas is not selectable now.
- **The WebGL renderer takes one context for a sheet** — it created a second one only to find out whether WebGL exists, and lost it at once. Firefox logs a warning for every lost context, so every sheet logged one at mount. The check no longer creates a context.
- **No error in Safari's console when the browser takes the WebGL context away** — the renderer answered a lost context by losing it again.

## [0.25.1]

The WebGL renderer (`@surdeddd/bottom-sheet/webgl`) after its first check on a real screen. Nothing outside the `/webgl` entry and the demo changes.

### Fixed

- **The far edge of the WebGL surface stays straight** — the bend moved the whole surface, not only its leading edge, so the edge on the other side carried the same curve. On a sheet dragged fast past its largest snap point that edge lifts off the screen, and it showed up bent and wobbling. The bend now fades along the sheet and is gone at the far edge. The same holds for a sheet that floats above the edge of the screen, and for sheets on the other three sides.
- **The WebGL surface follows a sheet the on-screen keyboard lifts** — the stylesheet raises a bottom sheet above the keyboard with a transition, and the renderer redrew only when the engine moved the sheet. The content rose and the surface stayed behind it, under the keyboard. The surface is now redrawn for as long as a transition on the sheet is running.

### Changed

- **The WebGL surface is flat unless you ask for the bend** — `jelly` defaulted to `0.5`, and on a fast drag the corners of the sheet's leading edge trailed its middle by up to 22 px. The default is `0`: the GPU draws the surface and moves it with the sheet, and nothing bends. `webglRenderer({ jelly: 0.5 })` brings the bend back as it was.
- **The content lift needs `jelly`** — it exists to make the content follow the bend, so without one it stays idle, and a development build warns about it. `webglRenderer({ lift: contentLift() })` becomes `webglRenderer({ jelly: 0.5, lift: contentLift() })`.
- **The demo's WebGL switch has a toggle for the bend**, between the renderer and the content lift, and `jelly=1` in the link. A link with `lift=1` alone still switches both on. All of it still shows up only when the link carries `#webgl=1`.
- **`/webgl` is 5.8 KB gzip**, up from 5.5 KB; with the content lift it is 10.0 KB.

## [0.25.0]

The questions that 1.0 would have frozen are answered here, while the answers are still additive. Two of them change what existing code sees, and are listed first.

### Changed

- **A move's promise says how it ended** — `snapTo()`, `open()`, `close()`, `expand()` and `collapse()` resolved with nothing, whether the sheet landed, the move was refused, or another move took over. They resolve with `"landed"`, `"vetoed"` or `"replaced"`: landed when the sheet rests on the point that was asked for, also when it was there already; vetoed when the move never began, because a `before-snap` or `before-close` listener refused it, `persistent` or `disableClose` blocked it, the point is unknown or not allowed, or the sheet is destroyed; replaced when another move, a drag, the move's own `signal` or `destroy()` took over on the way. Code that awaits the promise or ignores it is not affected. A function declared to return `Promise<void>` that returns one of these calls no longer type-checks: declare `Promise<MoveOutcome>`, or `await` the call.
- **`open()` on an opening sheet waits for it** — called without an id on a sheet that was already on its way open, `open()` resolved at once. It resolves when that opening lands, with its outcome.
- **A sheet that does not trap focus is a `region` in every adapter** — React and Vue rendered `role="region"` without `focusTrap`; Svelte, Solid, Qwik and `<bottom-sheet>` rendered `role="dialog"`, and the custom element carried `aria-modal="false"`. All of them now render a `region` without `focusTrap` and a `dialog` with `aria-modal="true"` with it. A selector or a test that looks for `[role="dialog"]` on a sheet without `focusTrap` needs the new role.

### Added

- **`bounds: "container"`** — sizes are measured against the window: `"50%"` is half of it, `"full"` all of it, and a sheet inside a panel had no way to say "half of my panel". With `bounds: "container"` the engine measures `"full"`, percentages, CSS lengths that contain a percentage and `maxHeight` against the sheet's nearest positioned ancestor, follows that ancestor when it is resized, and the stylesheet places the sheet, its backdrop, scrim, anchors, scrim stages and button slots inside it. The default stays `"window"`. A sheet bound to a container does not rise for the on-screen keyboard, which belongs to the window; without a positioned ancestor the option falls back to the window.
- **`label` on a snap point** — a screen reader heard the raw id of a point, such as "minimized", as the slider's value and in the live region. `{ id: "peek", size: 120, label: "Collapsed" }` gives it a name in the language of the interface. The state has `activeLabel` next to `activeId`.
- **`MoveOutcome`** — the type of the three outcomes, exported from every entry that exports the engine's types.
- **`anchors` and `scrimStages` as props in Svelte and Solid** — they were available there only through `addAnchor()` and `setScrimStages()` with elements of your own. Solid takes a `node` with each, as React does; Svelte takes a `content` snippet, which receives the state.
- **Descriptions in the published types** — every engine option carries its description and default from the README, so an editor shows them on hover. The sources stay free of comments; the build writes them into `dist`.

### Fixed

- **The sheet stays above the on-screen keyboard** — while the keyboard is open the engine shortens the sheet to the room the keyboard leaves. Anything that measured the snap points again took that limit away: a resize of the page, `recompute()`, `setSnapPoints()`, a new `maxHeight`, content that changed size under a `"fit"` point, or a keyboard that opened in the frame the sheet was created in. The sheet went back to its full size while it was still lifted, and its top left the screen until the keyboard moved again. The limit now holds for as long as the keyboard is open and is dropped when it closes.
- **Two unit tests no longer depend on the machine's load** — the retarget test measured how far one frame moved a tween in real time, and the root resize tests slept for 60 ms and expected to find the sheet in mid-flight. Both failed with correct code on a busy machine. They run on a faked clock, and the retarget test asserts the exact continuation.

### Sizes

The four additions and the keyboard fix cost about 0.4 KB gzip in every bundle that holds the engine: the full engine is 26.0 KB (25.6 before), the slim core 22.2 KB (21.9). The Svelte and Solid adapters also carry the new props and are 29.3 KB and 28.0 KB (28.4 and 27.4).

## [0.24.4]

The WebGL renderer (`@surdeddd/bottom-sheet/webgl`), reworked after it was tried on real devices, where the surface shook during a drag and the text jumped at both ends of one. Nothing outside the `/webgl` entry changes, and the renderer stays experimental until it has been checked on real phones.

### Fixed

- **The surface no longer shakes during a drag** — the bend was computed from how far the drag had travelled, not from how the sheet was moving. Past 126 px of travel it sat at its 22 px limit, sagged while the finger rested and jumped back to the limit on the next pointer event; a finger on a touch screen never rests, so the surface jerked for as long as it was held. The bend is now a damped spring on the real position of the sheet's leading edge: the middle of the edge stays on the sheet, the corners trail by at most 22 px outside it and 8 px inside, and it is flat about a third of a second after the sheet stops. It runs the same in a snap animation as in a drag, at 60 and at 120 frames a second, and along its own edge for a sheet docked to a side.
- **The surface cannot fall a frame behind the sheet** — during a drag the surface waited for its own next frame. It is now redrawn in the task that moves the sheet, once a frame.
- **The text does not jump** — up to 0.24.3 every drag swapped the content for a picture of it that a 2D canvas had laid out again, and the two did not match. Now the content stays in the DOM unless you ask for it to bend (see Changed), and when it is lifted:
  - it is drawn where the browser drew it — line by line from the boxes the browser reports, at the baseline the layout engine reports for the font, on the same device pixel row, with `letter-spacing` and `text-transform` applied. The share of the sheet's pixels that differ between the DOM and the lifted picture was 1.4–3.9 % across the three engines. It is now 0 in Firefox; 0.04 % in WebKit, where single glyphs differ by a fraction of a pixel; and in Chromium on a real screen the same 0–0.07 % by which Chromium itself repaints a DOM sheet that is pressed;
  - what cannot be reproduced exactly is left in the DOM instead of being approximated: SVG, form controls, gradients, shadows, decorated text, generated content, anything transformed, filtered or clipped. Text hidden for screen readers no longer shows up in the picture;
  - a press that does not move the sheet changes nothing on screen. The picture takes over once the sheet moves, and the content is back in the DOM a few frames after the release;
  - handing the content back does not move it. Chromium paints text on different pixel rows with and without `will-change: transform` on the sheet, and the engine drops that hint when the sheet stops; the renderer keeps it for the one frame of the hand-back.
- **The sheet's own border does not stay straight over a bent edge** — while the renderer draws the surface, the stylesheet makes the border of `.bs-sheet` transparent along with its background.

### Changed

- **The content bends only when asked, through `lift`** — until now it was lifted unless `liftContent: false` was set. The lift is a separate export, `webglRenderer({ lift: contentLift() })`, so its code stays out of your bundle unless you import it. Without it the content rides on the sheet as DOM and only the surface bends. `liftContent` is still accepted and no longer does anything.
- **`/webgl` is 5.5 KB gzip**, down from 6.4 KB; with the content lift it is 9.8 KB.
- **The demo's WebGL switch has a second toggle** for the content lift. Both still show up only when the link carries `#webgl=1`.

### Added

- **`contentLift()`** and the `lift` option of `webglRenderer()`.

One limit is known and documented: under an emulated device pixel ratio — Chromium's device toolbar and the test tools built on it — Chromium rounds text to whole CSS pixels, so lifted lines can sit one device pixel off there. A real screen is not affected.

## [0.24.3]

Release process only: no code or documentation in the package changes.

### Fixed

- **The npm page shows the English README.** npm reads the readme from the package directory and, with `README.md` and `README.ru.md` side by side, picked the Russian one, so the npm page has been in Russian since 0.23.4. The release workflow now leaves `README.ru.md` out before publishing. It stays in the repository.

## [0.24.2]

Documentation and demo only: no code in the package changes.

### Changed

- **The WebGL renderer is marked experimental.** On real devices the text visibly shifts when a drag starts and when the sheet settles: it moves between the DOM and a texture drawn on a 2D canvas, which lays text out differently from the browser. The guide lists the known issues, the README and `llms.txt` mark the entry as experimental, and `docs/api-stability.md` leaves `/webgl` out of what 1.0 freezes. Use the default DOM renderer in production.
- **The demo's WebGL switch is off the workbench.** It shows up when the link carries `#webgl=1`, for testing on devices, and is labelled experimental.

## [0.24.1]

Fixes to the WebGL renderer (`@surdeddd/bottom-sheet/webgl`), found by measuring it in Chromium, WebKit and Firefox and by switching it on in the demo. Nothing outside the `/webgl` entry changes.

### Fixed

- **The renderer steps aside on a software rasteriser** — a browser without a usable GPU still hands out a WebGL context and draws it on the CPU (SwiftShader, llvmpipe, the Microsoft Basic Render Driver). The renderer took that for a GPU. Measured on SwiftShader at a device pixel ratio of 3, a frame cost 285–370 ms of CPU time and the sheet moved at 2–6 frames a second, where the DOM renderer needs 2.5 ms and holds 60. It now declines with the reason `software-renderer` and the DOM renderer draws.
- **The surface follows the theme** — the panel's colour and radii were read once, and again only when the window was resized, so switching a theme left the old colour under the new text. They are re-read when the system colour scheme changes, when an attribute changes on an ancestor of the sheet or the sheet's own `class` does, and after every drag and every snap. Ancestors are followed out of a shadow root, so `<bottom-sheet>` follows the page's theme too.
- **The surface survives a window resize** — the stylesheet makes the sheet transparent while the renderer is on, and the renderer re-read the sheet's colour without lifting that rule. A sheet coloured the documented way, through `--bs-surface`, was read as transparent, and its surface vanished on the first resize of the window, which on a phone is the first rotation. A sheet with a transition on `background-color` lost it the same way: the read returned the first frame of the transition.
- **The surface is drawn on the sheet inside a transformed or contained ancestor** — the canvas was fixed to the viewport. An ancestor with `transform`, `contain` or `filter` moved it into its own corner and the surface landed beside the sheet; inside a plain clipping container the surface spilled out under the container. The canvas now takes the sheet's positioning and its containing block.
- **Only the corners the sheet rounds are rounded** — the shader rounded all four, so a bottom sheet at its tallest snap showed the page through two notches on its bottom edge. Each corner now takes its own radius from the sheet.
- **Scrolling the page under a sheet does not redraw it** — with `lockBodyScroll: false` every scroll event cost four redraws and two style reads for a sheet that had not moved.

### Changed

- **No multisampled buffer** — the surface is one triangle whose edges are smoothed in the shader, so the 4x multisampled context bought nothing. At a device pixel ratio of 3 that was a 1179×2556 buffer with four samples a pixel. The context keeps its drawing buffer between frames instead (`preserveDrawingBuffer`): without multisampling WebKit on Linux showed every frame one draw late.
- **`/webgl` is 6.4 KB gzip**, up from 5.9 KB.

### Added

- **`allowSoftware`** — an option of `webglRenderer()` that draws on a software rasteriser anyway, for screenshots and tests on machines without a GPU. The matching reason for `onUnsupported` is `software-renderer`.

## [0.24.0]

This release has three sources: a full audit of 0.23.4, six bugs reported from a production app, and a pass that ran every option and every adapter in a real browser and brought the adapters and the documentation level with the engine. Most of it is behaviour that now matches the documentation. The changes visible to code that relied on the old behaviour are listed first.

### Changed

- **`open` and `close` fire when the transition starts, `opened` and `closed` when it lands** — this is what the README and the adapter docs have always said; the engine fired both pairs at the end of the animation. The body scroll lock, the focus trap, `inert` and the history entry now go on when the opening starts, and the history entry comes off when the closing starts. A transition reversed half-way announces itself again (`close`, `open`, `opened`), so `open` and `close` strictly alternate, while `opened` and `closed` report a landing and are skipped when there was none. If you unmount the sheet on `close` or on `update:open`, do it on `closed`: the exit animation now runs after `close`. Vue's `v-model:open` and Svelte's `bind:open` flip at the start for the same reason.
- **The Vue component uses the engine's defaults** — `lockBodyScroll`, `closeOnEscape`, `rubberBand`, `dragFromContent` and `respectReducedMotion` were `false` in `<BottomSheet>` when not passed, because Vue turns an absent boolean prop into `false` before the engine sees it. They are `true` now, as documented and as in every other adapter; `initialFocus` falls back to the first focusable element instead of the sheet container. Pass `:lock-body-scroll="false"` and so on to keep the old behaviour.
- **`persistent` stops every way the user can close the sheet, and `disableClose` stops the code too** — a `persistent` sheet closed on the Back button, on a drag down to the closed point and on Home or the shrinking arrow on the handle. All of those are now refused: the drag stops at the smallest open point, the keys skip the closed one, and Back gives the history entry back. `close()` and `snapTo()` from your code still work, which is the point of the option. `disableClose` blocked `close()` only; it now also refuses `snapTo("closed")`, `setAllowed(ids, "closed")`, the drag and the keys.
- **`open()` leaves an open sheet where it is, and `close()` always has somewhere to go** — `open()` without an id moved an open sheet back to its first open point, so calling it on a sheet resting at `full` shrank it to `peek`. It is now a no-op on a sheet that is open or opening; `open(id)` still moves it. `close()` on a sheet with no point of size `0` went to the first allowed point, wherever that was in the list; it now goes to the smallest one.
- **`backdropColor` and `backdropOpacity` do what their names say** — `backdropOpacity={0.5}` in React, Vue and Svelte did not halve the dimming: it was passed on as a range of progress, so the backdrop reached full opacity by the middle of the sheet's travel. `backdropColor` painted the scrim layer on top of the backdrop, so a lighter colour made the page darker and `transparent` did nothing. Both are engine options now, with `setBackdropOpacity()` and `setBackdropColor()` behind them: the opacity scales the whole fade, and the colour goes to the backdrop. On the custom element `backdrop-color` paints the backdrop and `scrim-color` the scrim; they were aliases. If you used either to tint the scrim layer, use `scrimColor`.
- **A closed `open` starts the sheet closed in Vue and Svelte** — with `v-model:open` or `bind:open` at `false` and the closed point not first in the list, Vue showed the sheet while `open` said `false`, and Svelte mounted it open and then closed it, firing `close` and `closed`. Both now start at the closed point, as React, Solid, Qwik and the custom element do. `snap` names the starting point when `initial` is absent; in Svelte that used to be an animated move after mount.
- **React `onChange` fires for a new state** — it also fired after every render that passed a new function, which is every render of a parent with an inline handler.
- **Svelte takes `teleportTo` on its own** — it was ignored unless `teleport` was set as well. `teleport={false}` still switches it off.
- **Engine-level teleport wraps what it moves** — `teleportTo` in the React hook, the Vue composable, Svelte, Solid and Qwik moved the backdrop, scrim and sheet straight into the target, out from under `.bs-root`, where every theme default is declared: the sheet came out with no background, no radius and a transparent backdrop. They now go into a `div.bs-root[data-bs-teleported]` created in the target, which copies the original root's classes (and follows them when they change) and its inline custom properties. A selector such as `body > .bs-sheet` no longer matches. The Vue component is not affected: it teleports its whole root with `<Teleport>`.
- **`closeOnRouteChange` means the address changed** — it reacted to every `pushState` and `replaceState`, so a router saving the scroll position with `replaceState(history.state, "", location.href)` closed the sheet. It now closes when `location.href` changes.
- **An open sheet stays open when its snap goes away** — `setSnapPoints()` and `setAllowed()` moved a sheet whose active snap was removed to the first allowed point, which in most lists is the closed one, so swapping the points under an open sheet closed it. It now moves to the nearest point that keeps it open and closes only when no open point is left. The second argument of `setAllowed()` still picks the point explicitly.
- **The stylesheet sizes the sheet by its border box** — it relied on the page's `box-sizing` reset. Without one, and always inside the shadow root of `<bottom-sheet>`, the sheet was a pixel taller than its snap size and the handle was 56px tall instead of its 44px minimum. The custom element now measures the same as every other adapter, so its handle is 12px shorter than in 0.23.
- **The handle's arrow keys follow a right-edge sheet** — `ArrowRight` grew a sheet docked to the right, against the direction it moves. As in `top` mode, the arrow that points away from the edge now grows the sheet: `ArrowLeft` for `right`.

### Added

- **The sheet rests on top of the on-screen keyboard** — a bottom sheet used to stay at the bottom of the layout viewport, under the keyboard, with only its height capped. The engine now publishes how much of the screen the keyboard covers as `--bs-keyboard-inset`, and the stylesheet lifts the sheet, its anchors, the above-sheet scrim and the button slots by it. A pinch zoom and a sliver under 60px are not treated as a keyboard. This is tested against an emulated `visualViewport`; see the note at the end.
- **A controlled `open` in React, Solid, Qwik and the custom element** — `open` with `onOpenChange` (`onOpenChange$` in Qwik), and a reflected `open` attribute on `<bottom-sheet>`. Vue and Svelte had `v-model:open` and `bind:open` already. Qwik also gets `snap`: it has no ref, so until now it could not send a sheet to a point.
- **Every engine option in every adapter** — Svelte, Solid and Qwik each forwarded a hand-picked list and dropped the rest silently: `scrimPreset`, `inertSiblings`, `routedTo`, `persistKey`, `autoCollapseAfter` and a dozen more did nothing there. They now pass every option through, from one list that a type-level test keeps complete. The custom element takes the options it has no attribute for through `options`, as a JSON attribute or as a property.
- **`handleLabel` and `contentLabel`** in every adapter (`handle-label` and `content-label` on the element) — the accessible names of the handle and of the scroll area were fixed English strings.
- **`backdropOpacity` and `backdropColor` as engine options**, with `setBackdropOpacity()` and `setBackdropColor()`.
- **Svelte:** `addAnchor()`, `setScrimStages()` and `recompute()` on the component, a reason for `close()`, the drag payloads in `ondragstart` and `ondragend`, and types for the component's methods, so `bind:this` is no longer `{}` to TypeScript.
- **`llms.txt`** in the package: the whole API in one file, written for AI coding assistants.
- **`engine.state.phase`** — `"closed" | "opening" | "open" | "closing"`, also in the state every adapter exposes.
- **`historySettled()`** — exported from the main entry and from `/features`. `closeOnBack` and `routedTo` pop their history entry with `history.back()`, which the browser applies asynchronously; a navigation issued before it lands is rolled back by it. `await sheet.close()` now waits for the pop, and `await historySettled()` covers code that does not await the close.
- **`data-bs-focus-allow`** — put it on a dropdown, date picker or autocomplete that a UI kit renders outside the sheet, and the focus trap leaves focus inside it alone.
- **`on()` on the React handle and hook** — `ref.current.on("snap", fn)` subscribes to engine events; a subscription made before the engine exists is attached when it is created.
- **`physicalMode`, `restAtStart` and `setMode()` from the Vue composable** — what a hand-written template needs to render `data-mode` and `data-bs-rest` correctly for logical modes and server markup.
- **`setMode()` on `<bottom-sheet>`**, and `start` / `end` as values of its `mode` attribute.

### Fixed

Transitions

- **A finger that caught a moving sheet completed the snap** — pressing the handle while the sheet was closing fired `close` and `closed`, released the scroll lock and the focus trap and set `data-bs-rest="closed"` while the sheet was still on screen under the finger. An interrupted transition now stays in its phase until it lands.
- **A resize, a keyboard, `recompute()` or `setSnapPoints()` cut the running animation short** — the sheet jumped to the target, and with `setSnapPoints` no `snap`, `open` or `opened` followed, the page stayed unlocked and no history entry was pushed. The running animation is now retargeted and lands normally. Content that grows while the sheet opens is followed to its full size: a 776px sheet no longer stops at 239px. `setSnapPoints` also keeps the `maxHeight` cap, which it used to drop, pushing the sheet off screen.
- **A sheet opened in the tick it was mounted flashed at full size for a frame** — the first content measurement wrote the final size under the running animation.
- **A `visualViewport` resize that changed nothing interrupted the animation**, and any `visualViewport` event shrank a full-height sheet by 8px: the keyboard safety pad applied even with no keyboard.
- **A tab sent to the background mid-animation stranded the sheet** half-way with the backdrop up; the transition now lands at once.
- **`open()` and `close()` in the same tick** left the sheet reported closed but visible, or open but hidden; two `snapTo()` calls in one tick left `activeId` and the position disagreeing.
- **`close()` on a closed sheet fired `close` and `closed`**, and a second `close()` during the exit restarted the animation and asked `before-close` again. A repeated `snapTo()` to the id already in flight no longer restarts the animation either.
- **A listener that threw stopped the lifecycle** — an exception in a `close` handler left the page scroll-locked until reload. Listeners are isolated; the error is rethrown asynchronously.
- **A spring with no damping never finished** — it is now cut off after three seconds and lands on its target.
- **Opening to a `content` or `fit` snap that still measured zero jumped open later without animating** — it now opens with the full animation and events once the size is known.
- **A closed sheet could keep the page covered** — writes of `--bs-progress` and of the dim layers are thinned out while the sheet moves, and the last write of an animation went through the same threshold. A spring ends in steps smaller than it, so the scrim was left at an opacity like 0.003 and never got `display: none`: with `scrimInteractive` or `scrimTapToClose` it went on catching every tap on the page after the sheet had closed. For the same reason `--bs-progress` and the backdrop rested at values like 0.998 instead of 1. What is written once the sheet rests is exact now.
- **`autoCollapseAfter` could collapse a sheet in the middle of a transition** — the idle timer restarted only when a snap landed, so a timer armed earlier fired while the sheet was still animating to a larger snap. It now waits out an animation or a drag and starts counting again.
- **`state.isAnimating` stayed `false` during a view transition** (`viewTransitions: true`).

Focus and scroll

- **`inertSiblings` did nothing for a sheet inside a shadow root** — the walk up from the sheet stopped at the shadow root, so the page around a `<bottom-sheet>` stayed reachable. It now crosses the boundary through the host.
- **A selector in `initialFocus` could not find slotted content** — in `<bottom-sheet>` the focusable elements are yours and sit in the light DOM, where a query from inside the shadow tree does not look. The search now follows the slots.
- **Shift+Tab out of the sheet put focus on its first element** — focus that escaped backwards was sent to the first focusable element, not the last, so Shift+Tab from the top of a sheet did not wrap.
- **In a stack of sheets, typing into the upper one sent focus to the lower one** — the focus trap kept its own order by the moment each trap was installed, not by the sheet stack, so a lower sheet that finished opening later, or an upper sheet without `focusTrap`, left the lower sheet's trap in charge. The trap of the top sheet is the active one now.
- **Focus chosen while the sheet was opening was taken away when it landed**, and a field in a popup rendered outside the sheet could not be focused at all (see `data-bs-focus-allow`).
- **Shift+Tab on the first element of a `<bottom-sheet>` did not wrap** — the trap compared against `document.activeElement`, which is the host for anything inside a shadow root.
- **Scrolling the content while the sheet opened was undone when it landed**, and a reopened sheet came back at the scroll position of the previous open. The remembered position is restored when a collapsed sheet starts to expand, never at landing and never across a close.
- **Releasing the scroll lock animated the page back** under `scroll-behavior: smooth`.

History (`closeOnBack`, `routedTo`, `closeOnRouteChange`)

- **The sheet's history entry replaced the router's state** — vue-router keeps `current`, `position` and `scroll` in `history.state`; with the sheet's entry on top, `router.push()` built a URL from `undefined`. The entry now carries everything that was in `history.state`, including when it is restored after a cancelled close or re-labelled for a surviving sheet.
- **Closing a sheet could undo a navigation of the app** — the coordinator called `history.back()` on the assumption that its entry was the current one. If the app had pushed a route while the sheet was open, or navigated right after `await close()`, that route was popped. `back()` is now issued only when the current entry is the sheet's; a spent entry left behind is skipped when the user walks over it.
- **A hash link inside the sheet closed it** and left an entry behind on which Back did nothing; a reload with the sheet open left the same dead entry.
- **A routed sheet lost its address when the sheet under it closed.**
- **Removing the last `closeOnRouteChange` sheet broke `history.pushState`** when another script had wrapped it afterwards (`TypeError`, then infinite recursion on the next sheet).

Adapters

- **React `noSSR` left the sheet without an engine** — the documented fix for hydration mismatches produced a sheet that never moved.
- **Server markup painted a closed sheet open** until hydration; every adapter now renders `data-bs-rest="closed"` for a sheet that starts closed.
- **`mode="start"` / `"end"` were written to `data-mode` as is**, where no CSS rule matches them, in Vue, Qwik and the web component, and in React and Svelte when a physical mode changed to its logical twin.
- **Vue:** a `@snap` listener ran twice; `open` and `snap` ignored a prop reversed mid-animation; an inline `:snap-points` array reset the snap points on every parent render.
- **React:** `dragFromContent` was not reactive; a controlled `<Overlay>` whose parent mirrors `onChange` into `open` reopened itself. The refs returned by `useBottomSheet()` and `useOverlay()` did not type-check on a `<div ref>`, so the markup in the hook's own documentation failed to compile; they are callable refs now, fit any element, and still have `current`.
- **Svelte:** `open` and `snap` ignored a prop reversed mid-animation.
- **Solid:** an optional prop was ignored the first time it got a value; `radius` and `maxHeight` were not reactive; `header`, `footer` and the button slots were created twice. The published types of `/solid` carried their own copy of the engine class, so the engine handed to `engineRef` was not assignable to `BottomSheetEngine` imported from the main entry; every entry shares one declaration now.
- **Qwik:** the engine was created only when the component scrolled into view, so a sheet rendered far down the page stayed painted and dead.
- **Web component:** the `snap` attribute was ignored at creation; setting an attribute to its current value rebuilt the engine; a malformed `snap-points` shorthand threw from `connectedCallback`; an element with `slot="anchor"` was moved into the shadow tree and lost the page's styles.
- **Form guards** (`useFormGuard`, `useFormikGuard`) never bound when the sheet mounted a render later, and only guarded a snap called `closed`.

Layout

- **A `content` or `fit` sheet did not notice its header or footer growing** — only the scroll container's children were observed, so a taller footer was cut off below the screen edge.
- **`inertSiblings` left the rest of the app interactive** when the sheet lived inside the app root, and made an upper sheet inert when a lower one applied it. Everything outside the top sheet is inert now, level by level, and the set moves with the stack.
- **The scrim sat under a lower sheet and scrolled with the page** — its `z-index` did not follow the stack, and it was `position: absolute` next to a fixed backdrop. The engine publishes `--bs-z-sheet` on its root; `.bs-screen`, scrim overlays and scrim stages are `position: fixed`.
- **`setMode()` left the old edge behind** — switching axis with equal pixel sizes removed `height` without setting `width`; the above-sheet scrim inset, anchors, the scrim overlay and scrim stages kept their old positions.
- **Auto `aria-labelledby` never found the title** in adapter markup, where it lives in `.bs-header`, not in the handle.
- **The WebGL surface was drawn white** for a background written as `oklch()`, `color-mix()` or `color(display-p3 …)`, and its canvas did not follow the sheet's `z-index` in a stack.
- **Losing pointer capture mid-gesture** left the handle unable to start another drag.
- **A header or footer in `left` / `right` mode ran under the handle** — the side handle is a 28px strip over the sheet's inner edge, and only `.bs-content` was padded away from it, so the first letters of a title in `.bs-header` were covered. Header and footer get the same 36px inset.
- **Switching `scrimTapToClose` off left the scrim catching taps** — `setScrimTapToClose(true)` turned pointer events on for the scrim and nothing turned them off, so after `setScrimTapToClose(false)` the page under it stayed out of reach. The other way round, `setScrimInteractive(false)` and a round trip through the `above-sheet` mode silently disabled tap-to-close. The scrim takes pointer input exactly while it is interactive or has tap-to-close on.
- **`setSnapPoints()` blocked the new points when one old id survived** — the allow-list was carried over whenever at least one of its ids still existed, so replacing `peek`, `half` and `full` while keeping `closed` left only `closed` allowed. It is carried over only when it was a real restriction.
- **A fade that is scaled down or spread out could rest a few thousandths short** — with `backdropOpacity` below 1, or a `backdropRange` or `screenRange` wider than the sheet's travel, the last frame of an animation wrote the exact progress while the opacity change it implied was under the write threshold, and the write at rest skipped the opacity because the progress had not changed. The dim layers are always settled at rest now.
- A snap size the browser rejects as a CSS length now warns in development instead of silently resolving to 0.

The sheet stack, the scroll-lock counter, the focus-trap stack and the history coordinator are now shared through `globalThis`, so two entry points on one page (`/react` next to `/element`, or ESM next to CJS) no longer keep separate copies: a sheet from one was invisible to an overlay from the other, and the page was unlocked while one of them was still open.

Every option in the README table and every method of the imperative API is now exercised in a real browser: 150 tests per engine on Chromium, WebKit and Firefox, on a page without a `box-sizing` reset, for the engine, the custom element and the overlay. The Qwik adapter, which no test had ever mounted, has a browser check of its own (`npm run check:qwik-client`). That suite is what turned up the fixes in this release that the audit did not have, from the border box to the scrim that outlived its sheet. The README option table gained the options that worked but were never listed: `duration`, `easing`, `respectReducedMotion`, the `scrim*` family, `routedTo`, `persistKey`, `autoCollapseAfter`, `linkedSheets` and `viewTransitions`; `flickVelocity` and `dragThreshold` now say that they apply to touch and pen, while a mouse keeps fixed thresholds.

Measured against 0.23.4, the core entry grew by 3.2 KB gzip, to 25.6 KB; the framework adapters by 3.6–3.9 KB and the custom element by 4.3 KB; the slim core by 2.3 KB, `/overlay` by 1.4 KB, `/features` by 1.1 KB and `/webgl` by 0.2 KB. Most of it is the transition logic in the engine and the history coordinator; the adapters grew further because they now carry every option. Each budget that moved sits 30 B above the largest reading; `/webgl` stayed inside its budget.

Resting on the keyboard is verified against an emulated `visualViewport` in three engines. Automated tests cannot raise a native keyboard, so it has not been run on a physical phone; if a sheet with a focused field sits wrong on yours, please open an issue with the device and browser.

The documentation was rewritten against the source. The README has one option table grouped by topic, a quick start built on `open`, and sections on accessibility, forms and the keyboard; there are new guides for Qwik, theming, the overlay and `fitContentToSnap`; and the guides for Angular, Astro and Lit no longer tell you to link a stylesheet the custom element does not need. A test fails when an option or an attribute exists in the code and not in the README, its Russian twin or `llms.txt`, and `npm run docs:check` now follows every anchor. The examples in the README and the guides are compiled against the built package by `npm run check:types`; that is how the two typing bugs above were found.

The demo carried a stale hand copy of the library stylesheet, which is where its own visual bugs came from: sheet titles sat flush against the screen edge in the React, Vue and Svelte tabs, the custom-element and Lit sheets were white with an unreadable title in the dark theme and 32px wider than the screen, and a light-themed page on a dark-mode system painted the sheet black under black text. It imports `src/styles/bottom-sheet.css` now. Overlay mode works in every adapter tab instead of React only, the `top`, `left` and `right` peeks no longer cut the title, and the hero phone is a lit 3D model whose five layers dock one by one as the anatomy section scrolls, on phones too. From 961px up the device stays in a sticky column beside the live state, the usage code, the playground and the advanced cards, so every toggle can be watched taking effect. The Solid and Vanilla tabs render the same sheet as the other five, and the Russian page no longer has English left in it, aria-labels included.

## [0.23.4]

### Fixed

- **The Svelte component failed to resolve in every consumer build** — `@surdeddd/bottom-sheet/svelte` has a `svelte` export condition that points at `dist/svelte-src`, the component's source, so the consumer's own Svelte plugin compiles it. The package build copies `src/svelte/BottomSheet.svelte` there and rewrites its relative imports to the package root. The teleport import, added in 0.10.0, was never rewritten, so the shipped component imported `../core/features/teleport`, a path that does not exist in the published package. Any Vite or Rollup build that resolved the `svelte` condition stopped with `Could not resolve "../core/features/teleport"`, which also broke the repository's own Svelte example. The component now takes the teleport helpers from the built `svelte-core` chunk, which re-exports them; the public exports of `/svelte` are unchanged. The package build now checks every relative import in `dist/svelte-src` and fails with the file and specifier when one does not resolve, and a unit test covers the same check, so a new relative import in the component can no longer ship broken.

## [0.23.3]

### Fixed

- **Closing a sheet with a tap first lifted it up** — the tween took its start time from `performance.now()` when it was created, and each frame measured elapsed time against the frame's `requestAnimationFrame` timestamp. A tap is handled inside a frame, before that frame's callbacks run, so the first frame's timestamp is earlier than the start time, elapsed time comes out negative, and the default `easeOutBack` curve runs backwards: the sheet moved away from its target before heading for it. Measured through a real tap on the close button: the sheet rose from 364px to 425px in Chromium and by 13px in Firefox before closing, and an open dipped hundreds of pixels below the closed position (offscreen, so unseen). WebKit orders input and frames differently and was not affected. Elapsed time is now clamped at zero. The spring had the same clock and took a negative first step, which gave its first frame a velocity pointing away from the target; its clock is clamped the same way. This was also behind a CI flake that had been showing up since 0.23.1: on a slow runner the lifted handle of a closing sheet landed on the point the stack test probes.
- **`settleAnimation: "waapi"` left a pinned footer behind the sheet** — the sheet moves on the compositor, while the footer lift comes from `--bs-size`, which the main thread writes once per frame; WebKit samples the compositor animation ahead of that, so the footer trailed the sheet by 8–23px (30px on CI), and while the main thread is busy — the case the mode exists for — the lift stops updating and the footer rides along with the sheet instead of staying pinned. With `fitContentToSnap`, the footer now gets a Web Animation of its own, mirrored from the sheet's keyframes and started at the same start time, so the compositor moves both on one timeline: within 3px on every engine. The settle animation is tagged `bs-settle` so it can be found; the feature looks for it only when `settleAnimation: "waapi"` is set, so the default mode does no extra work per frame. The feature also switches to its moving layout right after `before-snap`, once the animation is running, instead of waiting for the first frame to report progress.
- **Pressing the handle during a `settleAnimation: "waapi"` settle threw the sheet back to where it started** — the press cancels the Web Animation, which removes its effect, and the sheet's inline transform had not moved since the settle began. Until the finger moved, the sheet sat back at its starting position, 230–250px away in the test fixture on all three engines. The runner now reads the position the browser is showing from the sheet's computed transform, commits it, and only then cancels the animation, so a sheet caught mid-settle stays where it is. The animation's own `currentTime` is not enough: WebKit reports it 11–18ms behind the position it shows, which would still leave the sheet up to 25px back.
- **`--bs-size` could rest up to half a pixel away from the sheet** — the core skips writes smaller than 0.5px, and nothing wrote the final size once the sheet stopped. After an animation that ends in small steps, such as a spring, the variable could stay up to 0.5px off: 472.6px for a sheet resting at 473px in Chromium. Anything placed from it, like a button riding the sheet's edge, sat that far off. Small writes are now skipped only during a drag or an animation, and the exact size is written when an animation ends. `fitContentToSnap` no longer writes the size itself.
- **`progress` skipped frames at the slow ends of a motion** — it fired only when progress moved by 0.005, about 3px at a 600px cap, so the start and end of an easing and a slow drag went several frames without an event, and anything placed from it could lag by up to 3px. It now also fires whenever the size written to `--bs-size` changes, which is every 0.5px; a list held at its end by `fitContentToSnap` now stays within 1px during an expand or a drag.

Several tests allowed far more than the code needs, which let the bugs above through. The end-of-list test allowed 48px because it measured the gap to the screen edge, which includes the list's 16px bottom padding; it now measures drift after each painted frame and allows 2px. The WAAPI footer test allowed 24px on WebKit and 6px elsewhere; it allows 3px everywhere. The gap between the last row and the footer must now match the list's bottom padding within 1px instead of staying under 40px, and two fit sheets opened in different ways must agree within 0.5px instead of 6px.

Measured one entry at a time, `/features` grew by about 370 B gzip, core and the adapters by about 530–570 B, and the slim core by about 185 B. `size-limit` runs its checks concurrently, and the same build then reads up to 30 B higher or lower from run to run, so each budget that moved now sits at least 30 B above the largest reading.

## [0.23.2]

### Fixed

- **The WebGL surface trailed the sheet by a frame during every programmatic snap** — the renderer's loop was woken from a `progress` handler, which runs inside the tween's own frame callback, so from then on the loop's callback was queued ahead of the tween's: every frame drew the panel where the sheet had been, and the tween moved the DOM after the draw. Measured with a hook on `drawArrays`: the drawn position was stale on 35–90% of the frames of a snap, by up to 128px in Chromium, 126px in WebKit and 38px in Firefox, so the white panel visibly lagged behind the handle and the text riding on it. The renderer now repaints the moment the engine writes the sheet's inline style, which puts the draw after the move in the same frame; the test asserts zero stale frames. The same observer fixes a quieter case: an idle size change too small to emit `progress` (a `setSnapPoints` that shifts the active snap by 2px) used to leave the surface where it was until the next gesture. There is still one draw per frame: during a snap the observer draws and the loop does not, during a drag the loop draws.
- **A WebGL drag painted rows scrolled out of the list over the handle and the header** — the content capture drew every element in the sheet at its position, ignoring the scroll container's clip, so with the list scrolled the rows above its top edge showed up across the handle for the length of the drag. The scroll container now gets a texture of its own, clipped to the container in the shader.
- **`fitContentToSnap` now works with the WebGL renderer too** — 0.23.1 left it on the old layout, so the scrollbar still ran under the screen edge and the footer was not pinned. With the renderer on, the layout is now the same as without it. Two things were in the way. The pinned footer used to be lifted into the texture, which moves with the sheet, so it stays in the DOM and flat now, and while the sheet moves it paints the surface colour, because the GPU surface has no way to hide the rows passing behind it. And a list held at its end during an expanding drag rode up with the texture by the length of the drag, while the DOM rows it stood for stayed put, and dropped back when the text was handed to the DOM. The list texture now follows the container's scroll position; it is captured with enough rows above the view to cover the scroll the engine may take back, and it lines up with the DOM rows to within 2px. The feature also switches to its moving layout on `dragstart` rather than on the first `progress`, so the capture sees the full-height container regardless of the order features are installed in.

The `/webgl` entry grew by 965 B gzip, to 5.8 KB, and `/features` by 18 B; both budgets moved by that much.

## [0.23.1]

### Fixed

- **With `fitContentToSnap`, a visible scrollbar ran off the bottom of the screen below the largest snap** — reported in [#41](https://github.com/Surdeddd/BottomSheet/issues/41) with a recording from a desktop browser. 0.22 made the end of the list reachable by putting a spacer inside the scroll container, but the container itself stayed as tall as the largest snap point, so the lower part of its scrollbar track sat under the screen edge: 301px at a half snap in the browser test, 255px with a footer. Scrolled to the end, the thumb was entirely in that part, and a Windows-style scrollbar never showed its down arrow. Overlay scrollbars on phones hide all of it, which is how it got through.

  At rest the stylesheet now shrinks the container itself by the part of the sheet that is off screen, with a flex spacer after the last child of the sheet, so the track ends at the screen edge or at the top of the footer and the thumb is sized for what is on screen. The spacer is computed from the live `--bs-size`, not from the size at the last settle, because the engine reports `progress` only once the sheet has moved by about 3px: keyed to the settle, the first frames of a motion put the footer up to 2.6px off the edge under CPU load in testing, and an idle size change below that threshold went unnoticed. The moment the sheet starts to move, it switches back to the full-height container with the spacer inside it, so the rows below the edge are already laid out when a drag or an animation reveals them and the motion stays transform-only. The switch changes the box and the scroll range by the same amount, so the list does not move: zero drift of a row against the sheet on every painted frame of an expand and a collapse, and no gap under the list through those and a handle drag, in Chromium, WebKit and Firefox. Ionic solves the same problem for `expandToScroll: false` by animating the content's `max-height`, which costs a layout on every frame; this costs one layout when motion starts and one when it settles.

  At rest the footer is now placed by layout, and the per-frame lift applies only while the sheet moves. `data-bs-fit-content` on the sheet reads `rest` or `moving`, for anyone sizing a custom scroll container; `--bs-content-inset` keeps its meaning. The WebGL renderer keeps the 0.23.0 layout, because it captures the content at the start of a gesture. The `/features` budget moved by its measured growth, 37 B gzip; every other entry stayed inside its budget.

## [0.23.0]

### Added

- **`fitContentToSnap` now keeps the footer on screen as well** — a follow-up to [#41](https://github.com/Surdeddd/BottomSheet/issues/41). The footer is the last thing in a sheet that is always as tall as its largest snap, so below that snap it sat under the screen edge exactly like the end of the list did: at a half snap a "Confirm" button in the footer slot was simply not there. With the option on, the stylesheet lifts `.bs-footer` by `--bs-size − --bs-max-size`, which pins it to the bottom of the visible part of the sheet at every snap and on every frame of a drag or an animation. `--bs-size` is the variable the engine already writes per frame, the cap is written once per settle, so the footer costs no JavaScript per frame and no layout; the list's spacer already equals the hidden amount, so the last row ends above the footer instead of under it. The lift is clamped at the bottom of the header: on a snap too short for both, the footer slides under the screen edge rather than covering the handle. Measured in the browser tests on all three engines: footer bottom within 2px of the viewport bottom on every painted frame of an expand, a collapse and a handle drag, and within 0.1px at rest. The WebGL renderer is left out on purpose — its DOM footer has no background to cover the rows with.

  The feature also writes the exact resting size to `--bs-size` when the sheet settles. The engine skips per-frame writes smaller than half a pixel, which left the variable up to 0.5px behind the real size at rest: invisible for a backdrop, a hairline of scrolling rows under a pinned footer on a 3x screen.

### Fixed

- **`settleAnimation: "waapi"` reported a size the sheet was not showing** — while the compositor ran the transform, `--bs-size`, `--bs-progress` and the `progress` event were driven by a separate clock: wall time since the call, floored to the nearest sample. The animation itself starts a frame or two later, so everything keyed to those values ran ahead of the sheet or behind it — measured at up to 76px on a 250ms settle. Backdrop opacity hid that; a footer pinned through `--bs-size` did not. The tick now reads `animation.currentTime` and interpolates between samples, the same linear interpolation the keyframes get, so the reported size is the size on screen: 0px of drift in Chromium and Firefox, a few px for a frame in WebKit where the compositor samples slightly later.
- **A programmatic snap to the largest point overshot it under `settleAnimation: "waapi"`** — with an easing that overshoots, the rAF path clamps the size at the axis cap, but the WAAPI keyframes were built from the raw samples, so the whole sheet lifted off the bottom of the screen (17px in the fixture) and came back. Keyframes are now clamped the same way `applySize` clamps; a flick released with velocity is still allowed to overshoot, as before.

### Docs

- **Scrolling a list at every snap on touch needs `dragFromContent: false`, and the README now says so** — `fitContentToSnap` makes the end of the list reachable, but by default a finger on the content drags the sheet until it reaches its largest snap and only then scrolls, so on a phone the list still could not be scrolled at a half snap (a wheel or trackpad always could). The new "Scrolling the list at every snap on touch" section gives the recipe — `fitContentToSnap` plus `dragFromContent: false`, globally or per snap point — and the browser tests pin both halves of it with injected touch input: the default moves the sheet, the recipe scrolls the list, the handle still moves the sheet.

Budgets moved by the measured growth against 0.22.1: 114 B gzip on the core entry, 102–143 B on the framework adapters, 184–195 B on the custom element (it inlines the stylesheet), 40 B on the slim core and 72 B on `/features`.

## [0.22.1]

### Fixed

- **The README sent people to a demo that stopped updating in July** — the "Live demo" link pointed at `bottom-sheet-demo.vercel.app`, which belongs to an earlier Vercel project that no longer receives deployments: no 3D hero, no anatomy section, nothing from 0.20 onwards. The project this repository actually deploys from `main` lives at `bottom-sheet-demo-ashy.vercel.app`, which is what the repository's About link already used, so the two links showed two different sites. The README, `CONTRIBUTING.md` and the GIF-recording scripts now all point at the live one; the scripts mattered most, since by default they were recording the frozen build. No code change.

## [0.22.0]

### Added

- **`fitContentToSnap` — the whole scroll container is reachable at every snap point** — requested in [#41](https://github.com/Surdeddd/BottomSheet/issues/41). The sheet is always as tall as its largest snap and is moved with a transform, which keeps a drag on the compositor. The price was that below the largest snap the bottom of the scroll container sat under the screen edge by exactly `largest snap − current size`: measured on a 100-row list at a half snap, 254px of the container off screen and the last 7 rows impossible to bring into view without pulling the sheet up. `dragFromContent` never addressed this; it decides who gets a swipe, not how tall the visible band is.

  With the option on, the engine writes the hidden amount to `--bs-content-inset` when the sheet settles, and the stylesheet turns it into a spacer at the end of `.bs-content` plus a matching `scroll-padding-bottom`, so a focused field scrolls into the visible band rather than under the edge. That is one layout per settle and none per frame; the motion stays transform-only. The naive version of this has a visible flaw: a list scrolled to its very end rides up with an expanding sheet and then drops back by the full inset when the spacer collapses, 270px in the browser test. So while the sheet moves, the feature holds that list in place by clamping `scrollTop` to what the current size allows, which is how a native sheet animates its content inset. The scroll range is read once when motion starts and cached, so a frame with nothing to clamp costs nothing, and the live position is read only on the frames where a clamp is pending — enough to notice a user who scrolls back up mid-flight and yield to them. A list scrolled anywhere else is left alone, and a geometry change under an idle sheet, `setSnapPoints` adding a taller snap for one, re-seats the inset straight away.

  Off by default, so nobody pays for it unasked: 240–370 B gzip depending on the entry, and the budgets moved by exactly that. It applies to `bottom` sheets; other edges are a no-op for now. Every adapter takes it (`fit-content-to-snap` on the custom element), and on the slim core it is `contentFitFeature()` from `/features`, with the usual warning if the option is set without it. A scroll container that is not `.bs-content`, or one laid out as a flex row, can consume `--bs-content-inset` directly.

## [0.21.2]

### Fixed

- **One sheet landing teleported every other sheet that was still animating** — this is the rest of the "glitchy behaviour" in [#40](https://github.com/Surdeddd/BottomSheet/issues/40), and the part a user actually sees. Every engine watches `<html>` with a `ResizeObserver` so it can re-seat itself when the viewport changes, and the handler cancelled the in-flight animation and jumped the sheet to its target on *every* callback, whether or not anything had changed for that sheet. Opening a sheet ends by locking body scroll, which takes `<body>` out of flow and collapses the root element's content box from the page height to zero. `window.innerHeight` does not move, but the observer fires in every engine on the page. So when a list sheet landed, a detail sheet that had started opening over it was cut off mid-flight and snapped to its final position in a single frame: measured at 206px → 364px in one step, with the second sheet's 160ms open finishing after 28ms. With a spring and the reporter's 500ms gap that jump is half the screen. The handler now compares the sheet's seat before and after re-resolving — the active snap's clamped size and the axis cap — and leaves the sheet alone when neither moved. A real change still takes the old path: a percent snap follows a shrinking viewport, a pixel snap that no longer fits is clamped, and an open interrupted that way still runs its open sequence. This also stops a stray root resize from overwriting `size` in the middle of a drag.

  The teleport had been hiding two other things. It masked the double stack promote fixed in 0.21.1, because a second sheet that gets cut short lands in the same frame as the first and the wrong order never reaches the screen; with sheets animating to the end, the old promote shows up as 8–12 wrong samples per open. And it masked a race in `mount-open.spec.ts`, whose gate waited for a sheet to cross 250px and then asserted it sat at 300 — true only while a load-time resize was teleporting every sheet straight to its target. The gate now waits for the sheets to settle.

### Changed

- **The a11y and stacking E2E specs no longer depend on frame rate or on sampling mid-transition** — CI failed on WebKit for the 0.21.1 release commit with no library change involved. The dark-theme audit clicked the theme toggle and waited for `networkidle`, which returns at once on an idle page, so axe measured colours halfway through the theme's view transition and CSS colour transitions and reported a 2.19 contrast on a mid-tone that exists for a few frames. The audits now wait for the theme attribute and for every finite, clock-driven animation to finish; scroll-driven ones are excluded on purpose, since the hero title's `ViewTimeline` animation is "running" with one iteration and never finishes without a scroll. The stack-order test counted `requestAnimationFrame` samples and required more than four, and WebKit on the CI runner delivered exactly four; it now samples on a timer and keeps sampling after both sheets land, which is where the inversion lived.

## [0.21.1]

### Fixed

- **A sheet opened while another was still opening ended up underneath it** — the report in [#40](https://github.com/Surdeddd/BottomSheet/issues/40) was a list sheet, then a detail sheet opened over it half a second later, and the list jumping back on top once its animation landed. Every open promoted the sheet twice: once when the animation started, and again from `handleOpen` when it settled. With a spring taking longer than the gap between the two opens, the first sheet's second promote ran after the second sheet's first one and reordered the stack. Opening now promotes once, at the start, and the settle no longer re-asserts it. The stack keeps the order sheets started opening in, which is what the user saw happen and what the reporter's video shows the other way round.
- **The page flashed through while the top sheet closed over another** — 0.21.0 gave the backdrop to the top sheet only, so while the top sheet was closing its own scrim ramped down before the sheet below got its scrim back at the end. Anything under the pair was hoverable and clickable for the length of the close animation. That was a design mistake, and the reporter was right to call it out: every sheet owns its backdrop again, each one follows its own sheet's progress, and the sheet underneath stays masked for the whole close. The dimming stacks with depth, which is the behaviour every other sheet library exposes and the one people expect; pass `backdrop={false}` to the sheets you open on top for a single dim level. Both the 0.20.2 bug (a buried sheet's frozen scrim) and this one stay fixed because a buried sheet's backdrop now simply follows that sheet's own snap point rather than being gated on top status at all.
- **An `open` retargeted by `snapTo` before it landed skipped the open sequence** — the first call flagged the sheet as opening and the second, reading `size > 0`, treated it as a snap between two open points: no `open` / `opened` events, no focus trap, no body scroll lock, and a duplicate stack promote. The second call now inherits the in-flight open, so the sequence runs exactly once when the sheet finally settles.

## [0.21.0]

### Fixed

- **A buried sheet still stranded its backdrop — the 0.20.2 fix only worked in tests** — that release wrote the backdrop when the sheet was on top *or* when its opacity ramp resolved to exactly zero. Real close animations never reach exactly zero: `applyOpacity` skips a write once the progress delta falls under `OPACITY_WRITE_EPSILON`, so the final value settles around 0.002 and the exact-zero branch never fires. It fired in the unit tests only because they run at `duration: 0`, where the size lands on zero in a single step. In a browser a sheet that lost top status therefore never wrote its backdrop again, and closing it left the scrim frozen at full opacity with `pointer-events: auto` — the same full-screen click trap [#40](https://github.com/Surdeddd/BottomSheet/issues/40) reported, plus the doubled dimming from two live scrims. The backdrop target is now simply zero whenever the sheet is not on top, written unconditionally through the same sentinel, and a change of top status repaints the scrim immediately instead of leaving whatever the last frame wrote. Only the top sheet dims, a buried one holds nothing, and neither outcome depends on an animation landing on an exact value. Covered by eleven engine tests and a seven-case E2E fixture that mounts three real sheets; both fail against the previous code.
- **`element.animate` settles could run two native animations at once** — `animateTo` cancelled the tween and the spring before starting new work but not the WAAPI entry, while `runWaapiSettle` overwrote `currentWaapi` and left the displaced animation running. Its own cleanup only cancels when it is still the current entry, so the stale one kept driving `transform` from the compositor and fought the new settle. Only reachable with `settleAnimation: "waapi"`, which is opt-in, and it surfaced as a jump or jitter when a second `snapTo` landed mid-settle. `animateTo` now cancels it the same way `cancel()` always did.

### Changed

- **The `mode` prop is reactive in every adapter, and the Web Component no longer rebuilds for it** — Svelte, Solid, Qwik and the custom element had the same gap as React and Vue: the value reached `data-mode` and the engine kept its original axis. The element was worse than silent about it, since `mode` was not in its live-attribute set: changing the attribute tore the engine down and built a new one, so the sheet lost its open snap point and any imperative state along with it. All five now call `setMode`, which re-seats the axis in place and keeps the active snap point. An unknown value on the element still falls back to `bottom` rather than throwing.

## [0.20.2]

### Fixed

- **A sheet buried under a second sheet stranded its backdrop** — the backdrop's opacity ramp was gated behind `isTopSheet()`, so the moment a second sheet opened and took top status, the first stopped writing its own backdrop at all. Closing it then never brought the scrim back down: it stayed frozen at full opacity with `pointer-events: auto`, a full-screen click trap that only `destroy()` could clear, and a second dim layer stacked over the sheet still on screen. Nothing about it was visible as a backdrop — the page simply stopped responding to taps, which is why it read as erratic behaviour rather than a stuck element. The ramp is now computed unconditionally and written when the sheet is on top **or** when it resolves to zero: only the top sheet still dims, but a closed sheet can no longer leave a live scrim behind. Regression tests cover closing a buried sheet, rapid repeated opens, open/close churn across two sheets, and a close that lands mid-animation. Reported in [#40](https://github.com/Surdeddd/BottomSheet/issues/40).
- **The CSS subpaths shipped without type declarations** — `./styles`, `./styles.css` and the three themes mapped straight to a `.css` file with no `types` condition, so `import "@surdeddd/bottom-sheet/styles"` failed to resolve under `noUncheckedSideEffectImports`. Since `@vue/tsconfig` turns that flag on, every Vue consumer saw the error and no consumer `tsconfig` was at fault. Each CSS entry point now carries a `types` condition with the declaration emitted at build time, verified under `bundler`, `node16` and `nodenext`.
- **The Vue component's exposed API was missing from its public type** — the component was declared with `DefineComponent`'s `RawBindings` slot as `Record<string, never>`, so nothing from `defineExpose` reached the public instance type and `InstanceType<typeof BottomSheet>["open"]` collapsed to `never`. Every documented imperative call through a template ref — `sheetRef.value?.open()` — failed to typecheck, while working perfectly at runtime, which made it look like a consumer mistake. The exposed surface is now described as the exported `BottomSheetInstance` type, so `open`, `close`, `snapTo`, `expand`, `collapse`, `state`, `isTop`, `getEngine` and the rest are typed and callable. Runtime behaviour is unchanged; this was only ever a declaration defect.

## [0.20.1]

### Fixed

- **WebGL surface wobbled at high pixel ratios** — the signed distance field is evaluated in drawing-buffer pixels, which pass four thousand on a dpr-3 display, and the fragment shader ran at `mediump`. That is ten bits of mantissa in Chromium — around ±4px of error at those magnitudes — so edges crawled and corners missed their radius. WebKit hides it by making `mediump` a synonym for `highp`, which is why it only looked broken in some browsers. The shader now compiles as `highp`, with a `mediump` fallback for drivers that advertise it and then refuse to compile it.
- **The renderer now requests WebGL2 first**, falling back to WebGL1. The shaders are GLSL ES 1.00, which WebGL2 accepts as-is, so this is a context upgrade rather than a port: guaranteed fragment `highp` and no power-of-two texture restrictions. The capability probe checks both.
- **Lifted content stayed in the texture until the spring finished** — the WebGL renderer handed the sheet's content back to the DOM in the same branch that stopped its render loop, so the handover waited on the full settle animation. For the better part of a second after your finger left the screen the text was unselectable and softer than native, which read as the sheet being stuck mid-gesture. The content now returns as soon as the deformation has flattened — measured at 72ms against the previous half-second-plus — while the surface keeps drawing until the sheet stops. The bend is already zero by then, so nothing desynchronises.

## [0.20.0]

### Added

- **The WebGL capture now lifts backgrounds, borders and images** — phase 3 put only text into the texture, so during a drag a card's background and its icon stayed flat in the DOM while the type around them bent with the surface, and the layering was visible. Element backgrounds (with corner radii), borders and `<img>` content are now drawn into the same texture and hidden from the DOM for the duration of the gesture. A cross-origin image without CORS headers taints the 2D canvas — which surfaces at texture upload, not at draw — and the capture is dropped rather than failing, leaving the sheet with undeformed DOM content.
- **`setMode()` / `getMode()` — the sheet's edge is changeable at runtime** — previously the edge was fixed at construction and there was no way to move it at all; a drawer that wanted to switch sides, or a page that flipped writing direction, had to tear the sheet down and rebuild it. `setMode` accepts both physical edges and the logical `start` / `end`, re-resolving the latter against the direction in effect at the time of the call, which is what makes right-to-left switching work without a rebuild. The active snap point survives the change. It re-seats every part the edge decides: transform template, drag gesture (its sign flips), keyboard step direction, snap resolver, scrim insets, `data-mode`, and the ARIA slider orientation — that last one only when the axis actually changes, since left and right are both horizontal.
- **Computed-style E2E tests — `tests/e2e/computed-styles.spec.ts`** — assert the sheet's painted contract (radius, background, position, overflow, flex direction, overscroll), the handle bar's dimensions, the scroll container's overflow, the exposed `--bs-size` / `--bs-progress`, and the closed-state rule. Pixel snapshots are weak on small areas — a 3px radius change is tens of pixels out of hundreds of thousands, well under any workable ratio — and this closes that gap: verified by injecting exactly that change and watching it fail. Every assertion polls, because a single read catches pre-adapter values under a loaded parallel run.
- **Right-to-left support — logical `start` / `end` modes** — `left` and `right` are physical edges and stay physical; the new modes resolve against the direction that applies to the sheet, so `start` is the left edge in English and the right edge in Arabic. Direction comes from `getComputedStyle(element).direction`, falling back to the nearest ancestor with a `dir` attribute, and to `ltr` when neither is readable — a detached element resolves rather than throws. `SheetMode` now accepts both; everything downstream sees the resolved `PhysicalSheetMode`. Direction is read at resolution rather than watched — a `getComputedStyle` per frame for a property that changes approximately never is not worth it — so a page that flips language mid-session re-applies the mode through `setMode` (above) instead of rebuilding the sheet. See `docs/rtl.md`.

### Fixed

- **A scrolled list froze a left/right sheet** — the content-drag arbitration read `scrollTop` to decide whether a gesture belonged to the sheet or the scroller. That holds for `bottom` and `top`, where both share the Y axis, but a `left` / `right` sheet drags along X while its content scrolls along Y: once the list had been scrolled at all, every sideways gesture was handed to the scroller and the sheet could not be dragged from its content. Horizontal modes now arbitrate on the direction the finger actually favours, comparing travel along the sheet's axis against travel across it, and ignore `scrollTop` and `atMaxSnap` — both same-axis notions. A diagonal tie goes to the scroller.
- **A logical mode reached the DOM unresolved** — every adapter renders `data-mode` from the value you passed, and the stylesheet only has rules for physical edges, so `mode: "start"` would have left the sheet with `[data-mode="start"]` and no positioning at all. The engine now writes the resolved edge to `data-mode` itself, which fixes every adapter at once and makes the engine the single owner of that attribute. A logical value still appears in server-rendered markup until the engine mounts.
- **The demo re-broke the closed-sheet shadow fix** — `demo/style.css` paints its own per-mode shadow through `.bs-sheet[data-mode=bottom]` and never mentioned `data-bs-rest`. Same specificity as the library's closed-state rule, declared later, so it won: closed sheets in the demo painted a shadow again, undoing the fix released in 0.14.0. The library was never affected; only the demo. Found by the new computed-style tests, which pixel snapshots had been missing.

## [0.14.0]

### Added

- **WebGL renderer — `@surdeddd/bottom-sheet/webgl`** — an opt-in second renderer that paints the sheet on the GPU. At rest it draws the surface (panel, corner radii, shadow, edge sheen) and leaves text native, so it stays sharp and selectable. On `dragstart` the text is lifted into a texture and the whole sheet becomes one deformable surface — it bends with drag velocity, with glass refraction that scales with the bend — then hands the text straight back when the sheet settles. Registered as a feature (`features: [webglRenderer()]`), so it costs nothing unless imported: measured 4.2 KB gzip, main entry unchanged. Layout, scrolling, gestures and the accessibility tree never leave the DOM, which is what makes the fallback free — no WebGL, `prefers-reduced-motion`, SSR, or a lost GL context and the sheet simply paints itself again, mid-session if it has to. Options: `jelly`, `sheen`, `glass`, `shadow`, `liftContent`, `dpr`, `onUnsupported`. Refraction of the page *behind* the sheet is not offered and is not achievable: WebGL cannot read the pixels the browser composited for the rest of the document. See `docs/webgl.md`.
- **Browser support matrix — `docs/browser-support.md`** — the baseline (Chrome/Edge 80, Safari 13.1, iOS 13.4, Firefox 72) with what sets it, every progressive feature and what its absence costs, adapter peer ranges, and an explicit note on which claims CI actually exercises.
- **Security policy and contribution templates** — `SECURITY.md` with an explicit threat model (host-supplied markup is out of scope, exactly as with `innerHTML`), issue forms for bugs and feature requests, and a PR checklist covering this repo's actual traps.

### Removed

The package is `0.x`, where a minor bump may break API. The curation once
drafted for a distant 2.0 lands here instead; every removal has a replacement
that already existed in 0.13. See `docs/migration-v2.md` for the mechanical
edits — since the symbols are gone, `tsc` reports each remaining call site.

- **`OverlayEngine` / `Overlay` / `createOverlay` / `OVERLAY_PRESETS` and the Overlay types are subpath-only** — import them from `@surdeddd/bottom-sheet/overlay`. The barrel pulled ~4 KB gzip of overlay code into bundles that never touched it, and bundlers with imperfect tree-shaking kept it.
- **`attachGestures`** — use `installGestures`, which it aliased. The name now matches the other `installX` factories.
- **Engine-internal helpers off the public surface** — `tween`, `easeOutBack`, `easeOutCubic`, `prefersReducedMotion`, `runSpring`, `DEFAULT_SPRING`, `findNearest`, `findById`, `allowedRange`. They still run inside the engine; only the exports are gone. Observe state through `engine.state` / `engine.on(…)`, or inline the helper. For `prefersReducedMotion()`, read `matchMedia("(prefers-reduced-motion: reduce)").matches` — the engine now subscribes to a live listener.
- **React's `engine` field on the `useBottomSheet` return value** — use `getEngine()`. Under Strict Mode the layout effect double-invokes: teardown nulled the ref, so the field read `null` for a render and only the second mount restored a live engine. `getEngine()` reads the ref at call time and also covers the resize / `setSnapPoints` paths that fire no React-tracked event.

### Changed

- **Content gestures follow the finger** — a gesture on the scroll container now drags the sheet in real time (same physics, rubber band and `drag` / `dragend` events as the handle) instead of jumping to the neighbouring snap point after a 60 px threshold swipe. The gesture engages only while the scroller sits at its top; anywhere else the browser keeps the scroll. The `content-swipe` feature keeps its registry name.
- **All comments stripped from library and demo source** — only build-required pragmas (`@jsxImportSource`, `@ts-*`, `@vitest-environment`) remain. Type documentation lives in `docs/`, not in JSDoc, so editors no longer surface per-symbol hints from the published `.d.ts`.
- **`src/core/` is uniformly kebab-case** — `focusTrap` → `focus-trap`, `scrollLock` → `scroll-lock`, `sheetStack` → `sheet-stack`, `sheetManager` → `sheet-manager`, `cssLength` → `css-length`, `devWarn` → `dev-warn`. Internal paths only; consumers importing through the package see nothing. `BottomSheetEngine.ts` keeps its class-matching name, and React-style hook files stay camelCase.

### Added

- **Drag zones — `dragFrom` + `[data-bs-drag]` / `[data-bs-no-drag]`** — pick which regions of the sheet start a drag: `"handle"` (default when a handle is given), `"sheet"`, or `"zones"` where only `[data-bs-drag]` subtrees drag. `[data-bs-no-drag]` opts a subtree out in every mode, including inside the scroll container, so carousels and sliders stop hijacking the sheet. The handle always drags, whatever the mode.
- **`dragFromContent`, per engine and per snap point** — gates whether a touch gesture on the scroll container moves the sheet. Set it globally (`dragFromContent: false`), per point (`{ id: "full", size: "92%", dragFromContent: false }` — content only scrolls while expanded), or at runtime via `setDragFromContent()`. Exposed in every adapter; the custom element reads `drag-from` / `drag-from-content`.
- **`setDragFrom()` / `getDragFrom()`** — the drag surface is switchable at runtime: the engine tears the gesture off its current surface and remounts it on the new one (handle ↔ sheet ↔ zones), so a sheet can go from handle-only while collapsed to fully draggable while expanded without a remount. Reactive in every adapter; `drag-from` is now a live attribute on the custom element.
- **`attachDragSurface` on `EngineFeatureContext`** — features can hand another element to the engine's own drag physics instead of reimplementing them.

### Fixed

- **Closed sheets no longer paint a shadow band** — a closed sheet stays mounted and is hidden by a transform, which does not clip `box-shadow`, so its upward shadow painted inside the viewport; several pre-mounted closed sheets stacked into a visible band above the tab bar. `--bs-shadow-auto` now fades its alpha to a true zero over the last stretch of travel (identical at full extension), and a fully-closed sheet gets `data-bs-rest="closed"`, which drops `box-shadow` and `visibility` — covering static custom `--bs-shadow` values and the bundled themes as well, and keeping closed sheets out of hit-testing and the accessibility tree.
- **Bundle budgets were not enforced on `main`** — `size-limit` ran only on pull requests, so growth merged unmeasured; by the time the gate was added every entry had drifted over budget (core +426 B, react +440 B, vue +683 B, and so on). The check now runs in CI on push, and the ceilings were re-based on current measurements.
- **`setSnapPoints()` left the sheet unreachable when the id set changed** — calling it without the optional `allowed` argument kept the previous allow-list, so a wholesale swap of the point list left every new id blocked and the active id pointing at a point that no longer existed. `snapTo()` for any new id then failed silently: the sheet stayed at the removed point's size. The allow-list is now carried over only for ids that still exist, falling back to the full new set, and an active id that has disappeared moves to the first allowed point. Passing `allowed` explicitly behaves as before.
- **Demo stress test left the sheet where it stopped** — the run abandoned the sheet at whatever snap the last cycle hit and kept its timer alive after the page moved on. It now restores the starting snap, toggles its own label, and cancels on `pagehide`. It never reloaded the page: measured 0 navigations and 0 remounts across a full run.

## [0.13.0]

### Added

- **Slim core entry `@surdeddd/bottom-sheet/core`** — `BottomSheetCore`, the engine without optional features (~17.5 KB gzip vs ~23 KB full). Optional behaviors are now composable `EngineFeature`s registered per instance via the new `features` option; the default `BottomSheetEngine` keeps every feature preinstalled and its behavior is unchanged.
- **Feature factories entry `@surdeddd/bottom-sheet/features`** — `routeFeature()` (closeOnBack / routedTo / closeOnRouteChange), `visualViewportFeature()`, `contentSwipeFeature()`, `persistFeature()`, `autoCollapseFeature()`, plus `defaultEngineFeatures()`. Passing an option that needs a missing feature dev-warns once.
- **`settleAnimation: "waapi"` (opt-in)** — snap settles run as a real Web Animations API transform animation (spring trajectory pre-sampled into keyframes, compositor-driven and jank-resistant), while CSS vars / backdrop / `progress` events follow on a lightweight rAF companion. Falls back to the rAF spring automatically when `element.animate` is unavailable and under `prefers-reduced-motion`.
- **Qwik true SSR** — the package now ships `dist/qwik-lib/index.qwik.mjs` and declares it in the package `qwik` field, so Qwik apps pick the adapter up as a vendor root: the consumer's optimizer segments it into QRL chunks and `renderToString` produces a resumable (`q:container="paused"`) sheet. Guarded in CI by a full consumer client+SSR contract check (`npm run check:qwik-ssr`).
- **Debug overlay entry `@surdeddd/bottom-sheet/debug`** — `attachDebugOverlay(engine)` renders a live dev panel (active snap, size, progress, flags, resolved snap list) driven only by public engine events; zero bytes in other bundles.
- **Performance regression gate** — `npm run bench:check` compares hot-path benches against a committed baseline with a 10× floor (order-of-magnitude guard, CI-runner tolerant); wired into CI.
- **API docs on GitHub Pages** — typedoc build published via `docs-pages.yml` on version tags; https://surdeddd.github.io/BottomSheet/.

### Fixed

- **history-coordinator rebrand queue** — two programmatic middle-of-stack closes in the same tick could drop one marker rebrand (single pending slot); rebrands are now a FIFO queue paired 1:1 with suppressed history pops.
- `docs:api` script referenced a typedoc that was never installed; typedoc `0.28` is now a real devDependency (and TypeScript is pinned honest at `^5.9.3` — installing the old typedoc `0.25` silently downgraded TS below what `unplugin-vue` typings require).

## [0.12.0]

### Fixed

- **Hidden-at-construction initial-open sheets** — a `fit` / `content` (or any born-open) sheet mounted inside a `display:none` ancestor or detached from the document measured `0` at construction and locked collapsed (~4px) forever. Root cause: `measureSheetNatural`'s no-`scrollContainer` branch measured the element while the engine still pinned its height. Both measurement branches now poke `height: auto` before reading, so the sheet self-heals on reveal (via an `IntersectionObserver` fallback) and emits the full open sequence exactly once. A guard blocks a double `open` / `opened` when `recompute()` lands mid-open-animation.

### Added

- **`__bs: true` history discriminator** — every history entry the library pushes (sheet marker, `routedTo` marker, overlay marker, cancel-restore, internal rebrand) now carries `__bs: true` in `history.state`. A public, documented signal SPA router guards can test to skip the library's same-URL back-stack entries.

### Documentation

- z-index ownership (the stack controller owns inline `z-index` on `.bs-sheet` / `.bs-backdrop` / anchor wrappers), the `vue-router` guard integration pattern, the initial-open contract (born-open visible vs. hidden-at-construction), and the mount-tick `open()` guarantee (no `requestAnimationFrame` delay needed).

## [0.11.0]

### Added

- **Unified history coordinator** — one module-level owner for `popstate` and the `history.pushState` / `replaceState` patch, shared by `BottomSheetEngine` (`closeOnBack` / `routedTo` / `closeOnRouteChange`) and `OverlayEngine` (`closeOnBack`). One hardware Back closes only the top open surface of a mixed sheet+overlay stack; programmatic close of a lower surface keeps upper surfaces and marker accounting intact; a cancelled `before-close` restores exactly one marker.
- `closeOnRouteChange` now uses a single ref-counted history patch — original `pushState` / `replaceState` identities are restored after the last instance is destroyed regardless of destroy order.

### Fixed

- Overlay back-marker leaked when an open overlay was destroyed.
- View-transition `ready` rejection of a skipped transition surfaced as an `unhandledrejection` on rapid `snapTo`.

### Infrastructure

- Visual regression actually runs in CI (Linux baselines committed, unconditional skip removed); dev toolchain floor Node 20.19 (`.nvmrc`, CI matrix); live close/Escape e2e on a dedicated dismissible fixture; `react-dom/test-utils` → `React.act`; Svelte devDep patched to 5.56.4; `npm run e2e` and `docs:check` scripts.

## [0.10.0]

### Added — Event parity across every adapter

Every adapter now exposes the full engine event set (previously coverage was
uneven: Vue/Svelte 5 of 9, Qwik 3, Solid 4).

- **React** (hook + component): `onOpen`, `onClose`, `onDrag`, `onProgress` added, alongside the existing `onSnap` / `onBeforeSnap` / `onBeforeClose` / `onOpened` / `onClosed` / `onDragStart` / `onDragEnd`. `onOpen` fires on enter start, `onOpened` after the enter settles.
- **Solid**: `onBeforeClose` (synchronous, working `cancel()`), `onOpen`, `onClose`, `onOpened`, `onClosed`, `onDragStart`, `onDragEnd`, `onDrag`, `onProgress` — full parity with React.
- **Qwik**: lifecycle QRLs `onOpen$`, `onClose$`, `onOpened$`, `onClosed$`, `onDragStart$`, `onDragEnd$` added (alongside `onSnap$` / `onChange$`). See _Limitations_ for the events Qwik intentionally does not expose.
- **Vue**: `drag` and `progress` emits added.
- **Svelte**: `ondrag` and `onprogress` callback props added.
- **Web Component**: `drag` `CustomEvent` added (joining `drag-start` / `drag-end`).

`drag` / `progress` are hot-path: React, Solid and Svelte only subscribe to
them when the handler is provided **at mount** — the engine builds no per-frame
payload otherwise. Adding these handlers after mount has no effect.

### Added — cancelable `before-close` on Solid & Web Component

- **Solid**: `onBeforeClose` runs synchronously and can `cancel()` a dismissal.
- **Web Component**: the `before-close` `CustomEvent` is now cancelable — call `e.preventDefault()` to veto (mirroring `before-snap`).

### Added — Qwik teleport & lifecycle

- `teleport` / `teleportTo` props on the Qwik adapter (opt-in, off by default), mirroring Solid.

### Added — CSS tokens & high contrast

- `--bs-scrim-blur` now applies a real `backdrop-filter: blur()` on the scrim layer (`.bs-screen`) — the token was previously inert.
- `--bs-header-min-height` wired to the `.bs-header` region (default `0px`).
- `@media (forced-colors: active)` block so the sheet surface, handle and focus ring stay visible under Windows High Contrast.

### Added — engine

- `BottomSheetEngine.getResolvedSnaps()` — snapshot of every snap resolved to pixels right now; also exposed on `LinkedSheet`.

### Fixed

- **Overlay backdrop pointer-events** — a transparent backdrop no longer blocks clicks or silently swallows `closeOnBackdrop` / outside-pointer dismissal. `setBackdropOpacity` / `setOverlay` / `open` now resync backdrop `pointer-events`, and a `toast` overlay becoming visible regains interactivity.
- **React component prop types** — `onSnap`, `onBeforeSnap`, `teleportTo`, `backdropColor` and `backdropOpacity` are now typed on `BottomSheetProps` (previously a `TS2322` at the JSX boundary even though the runtime forwarded them).
- **Vue double-teleport** — the SFC drives the composable with `teleport: false`, so only Vue's `<Teleport>` relocates the DOM in the component path; the engine-level relocation no longer fights it. The standalone composable's `teleportTo` is unchanged.
- **visual-viewport vs. in-flight animation** — a soft-keyboard/viewport change during an animation now cancels the in-flight cycle and re-clamps (matching the resize-observer path), instead of the keyboard clamp being overwritten by the next animation tick.
- **linked-sheets size-0 target** — a linked sheet resolves its target to the first allowed snap with resolved size > 0, instead of snapping to a size-0 snap that happened to carry a non-`"closed"` id.

### Changed / Internal

- Engine `maxHeight` state extracted to `max-height-controller.ts`; a `cancelable-emit.ts` primitive backs `before-snap` / `before-close`.
- Overlay types and presets moved to `overlay-options.ts`, React config validation to `config-validation.ts` and the hook's prop-sync effects to `useEnginePropSync.ts` — all re-exported, public import paths unchanged.
- `devWarn` replaces raw `console.warn` in the engine, snap-points, Qwik and overlay — development-only warnings are stripped from production bundles (`NODE_ENV === "production"`).

### Limitations

- **Qwik** does not expose `onDrag$` / `onProgress$` (a QRL is a lazily-resolved reference; invoking one per frame is prohibitively expensive) nor `onBeforeSnap$` / `onBeforeClose$` (a QRL is async, but `cancel()` must be read synchronously right after the emit). Both exclusions are locked by a compile-time test. Use `getEngine()` and subscribe directly if you need per-frame or cancelable hooks in Qwik.

## [0.9.1]

### Fixed

- e2e viewport-resize probe accepts any of the three resize signals (`window.resize`, `visualViewport`, `ResizeObserver`) — Linux WebKit does not dispatch `window.resize`, and the engine relies on `ResizeObserver` / `visualViewport` anyway.

## [0.9.0]

### Added — `before-snap` across adapters

- `before-snap` (cancelable) surfaced on React (`onBeforeSnap`), Vue (`before-snap` emit), Svelte (`onbeforesnap`), Solid (`onBeforeSnap`) and the Web Component (cancelable `CustomEvent`). Qwik is excluded (async QRL cannot drive a synchronous `cancel()`).

### Added — runtime setters & reactive flags

- `BottomSheetEngine.setPersistent`, `setDisableClose`, `setDisableDrag` — flip dismissal/gesture behavior at runtime.
- `persistent` / `disableClose` / `disableDrag` are now reactive on every adapter (React effects, Vue watchers, Svelte `$effect`, Solid `createEffect`, Qwik `useTask$`) and live attributes on the Web Component (`persistent`, `disable-close`, `disable-drag`) — applied without re-init.
- `initialFocus: false` — focus the sheet container (adding `tabindex=-1` if needed) instead of autofocusing the first field; avoids the iOS software keyboard popping up when a sheet with an input opens.

### Added — parity features

- **Teleport for Solid & Svelte** — `teleport` / `teleportTo` props (opt-in, **off by default**, unlike Vue whose default is `body`).
- **`stackEffect`** wired through Svelte, Solid and Qwik (React/Vue already had it via `EngineOptions` passthrough).
- **Button slots for Solid & Qwik** — `leftButton` / `rightButton` (Solid JSX props; Qwik named slots), collapsing when empty.
- The Web Component preserves the active snap across DOM moves and structural re-inits when the id still exists in the new snap-points.

### Fixed

- **content-swipe double-action** — a swipe that actually scrolls the content no longer also nudges the snap (touchend compares `scrollTop` against the touchstart value).
- **Back after a cancelled `before-close`** — the popstate handler awaits `close()`; if `before-close` vetoed it, the history marker is re-pushed so the next Back closes the sheet and the page doesn't navigate away.
- **`opening` flag race** — `newCycle()` resets `opening`, and `snapTo` only clears it after the abort check, so an aborted cycle can't leave a closed sheet reporting `isOpen() === true`.
- **`will-change` leak** — a tap with no movement now clears the compositor `will-change` layer it set on `pointerdown` (both `settleAfterDrag` and `animateTo` early-returns).
- **String `maxHeight` re-resolve** — a `"92dvh"` / `"50%"` cap is re-resolved on viewport / orientation / visual-viewport changes and on `recompute()`, instead of sticking at its first-measured pixel value.
- **Shadow-DOM focus trap** — the Web Component's focus trap now sees slotted light-DOM fields (Tab cycles through them and focus-in no longer yanks focus out of them).
- **Sticky-footer measurement** — `size: 'content'` includes an in-flow `position: sticky; bottom: 0` footer inside `.bs-content` (measured via a `scrollHeight` floor).

### Changed / Internal

- Engine, overlay and Web Component decomposed into focused modules (`teardown-stack.ts`, `overlay-transforms.ts`, `overlay-swipe.ts`, WC `attributes.ts` / `shadow-tree.ts`); `fit`/`content` measurement moved to `fit-measurement.ts` + `fit-observer.ts`.
- React / Vue / Svelte / Solid / Qwik react to post-mount `snapPoints` and `allowed` changes (skip-first-run) — previously a size change was silently ignored and an id change could break `setAllowed`.

## [0.8.2]

### Fixed

- `size: 'content'` includes in-flow sticky footers via a `scrollHeight` floor.

## [0.8.1]

### Fixed

- Vue: `teleport={false}` also suppresses engine-level relocation.

## [0.8.0]

### Fixed

- `size: 'content'` measures the whole sheet (handle + header + content + footer, incl. in-flow sticky children) instead of just handle + content; the numeric `maxHeight` cap survives window / orientation / keyboard resizes; the rubber-band release recoil is restored (no one-frame snap); Solid & Qwik honor `persistent` on backdrop tap and gained `persistent` / `disableClose` / `disableDrag` / `closeOnRouteChange` / `returnFocusTo`.

## [0.7.0]

### Added

- Padding tokens for every region (`--bs-content-padding`, `--bs-handle-padding`, `--bs-header-padding`, `--bs-footer-padding`) — override or zero for edge-to-edge.

### Fixed

- `maxHeight`: a snap taller than the cap no longer shoves the sheet up off its anchor — it settles flush and the body scrolls internally. Solid gained `maxHeight` / `radius` parity.

## [0.6.1]

### Fixed

- Nested z-promote is synchronous for `content` / `fit` / `%` snaps (no one-frame behind-flash); composable `teleportTo` / `backdropColor` added to the Vue & Svelte `.d.ts` templates.

## [0.6.0]

### Added

- Composable options `teleportTo`, `backdropColor`, `backdropOpacity` (React / Vue / Svelte), backed by physical node relocation for the headless composables.

## [0.5.0]

### Added

- `size: 'content'` auto-resizes when its content grows/shrinks; a `footer` slot; `header` moved out of the grabber strip into its own `.bs-header` region.

## [0.4.1]

### Fixed

- Button slots (`leftButton` / `rightButton`) re-parented to `.bs-root` so they are no longer clipped by the sheet's `overflow: hidden` + transform; the engine writes `--bs-size` to the root.

## [0.4.0]

### Added

- Lifecycle & cancelable events (`before-close`, `opened`, `closed`); dismissal options (`persistent`, `disableClose`, `disableDrag`, `closeOnRouteChange`); `isTop()` / `depth()` / `expand()` / `collapse()`; `radius` / `maxHeight`; auto `aria-labelledby`; Vue `v-model` / Teleport / footer / anchors; Svelte & Web Component reactive parity; Web Component host-variable theming.

### Fixed

- `closeOnBack` no longer cascades through nested sheets; content-`fit` + `recompute()`; scrim default dim; synchronous z-promote.

## [0.3.0]

### Added

- Mode-aware `sheet-top-*` scrim positioning; `getEngine()` on all seven adapters; Svelte export condition; typechecked root configs.

### Fixed

- Bumped `devalue` 5.7.1 → 5.8.1 to clear a high-severity DoS advisory (GHSA-77vg-94rm-hx3p).

## [0.2.0]

### Added — Scrim runtime API

- `BottomSheetEngine.setScrimMode('full' | 'above-sheet' | 'off')` — runtime mode flip without remount.
- `BottomSheetEngine.setScrimEnabled(boolean)` — convenience disable/enable.
- `BottomSheetEngine.setScrimTapToClose(boolean)` — runtime install/teardown of click-to-close.
- `BottomSheetEngine.setScrimColor(color | null)`, `setScrimBlur(blur | null)`, `setScrimInteractive(boolean)` — live style mutators.
- `BottomSheetEngine.setBackdropRange([s, e])`, `setScreenRange([s, e])` — opacity range mapping setters.
- `BottomSheetEngine.setScrim(opts)` — batch update with preset + field overrides.
- `BottomSheetEngine.setScrimOverlay(opts)` — inject positioned floating element into scrim area; returns teardown.
- `BottomSheetEngine.getScrimState()` — read-only `{ mode, enabled }` snapshot for introspection without coupling to internal field shape.
- `EngineOptions.scrimPreset` — construction-time preset (`'subtle' | 'standard' | 'monitoring' | 'cinematic'`).
- `EngineOptions.scrimMode: 'off'` — new value to disable scrim.
- New types: `ScrimPreset`, `ScrimUpdate`, `ScrimOverlayOptions`, `ScrimOverlayPosition`, `SCRIM_PRESETS`.

### Added — Overlay runtime API

- `OverlayEngine.setOverlayChildren(node | fragment | factory)` — replace contents at runtime.
- `OverlayEngine.clearOverlayChildren()` — remove injected content.
- `OverlayUpdate.children` — batch field for `setOverlay`.
- `OverlayPreset` ('sheet' | 'dialog' | 'sidebar' | 'toast') with `OVERLAY_PRESETS` const map.

### Changed

- Demo's "Scrim" controls now use runtime setters — no adapter remount on toggle.
- Demo: added "Floating action" toggle demonstrating `setScrimOverlay`.

### Added — Plugin transactional install

- `Plugin.install` now accepts an optional second argument `scope: TeardownScope` with an `add(fn)` method. Plugins that register multiple side effects can push partial cleanups into the scope; engine drains them LIFO if `install` throws, or merges them into the destroy-time `TeardownStack` on success. Plugins ignoring the scope argument keep working unchanged. Exported as `TeardownScope` from the public surface.

### Refactored — internal architecture (no public API changes)

- **ScrimController extracted** — all scrim state (mode, ranges, color/blur, dedup caches, tap-to-close, overlay slot) and 10 setters moved to `src/core/controllers/scrim-controller.ts`. Engine setters become 1-line delegators; `BottomSheetEngine` LOC dropped 1650 → 1261 (-23.6%). Public API surface unchanged.
- **AnimationRunner extracted** — `currentTween`/`currentSpring` lifecycle, `animateTo`, reduced-motion `matchMedia` listener, view-transitions probe moved to `src/core/controllers/animation-runner.ts`.
- **LifecycleController extracted** — open/close install dance (focus-trap + scroll-lock + inert-siblings) shared between `BottomSheetEngine` and `OverlayEngine`. Overlay-specific knobs surfaced as opt-in: `shouldApplyInertSiblings` predicate (overlay's body-descendant guard) and `returnFocus` (focus restoration on dismiss).
- **GestureController extracted** — pointer-event ↔ size-translation pipeline (`onStart/Move/End/Cancel` callbacks, rubber-band clamping, soft-keyboard dismissal, drag-state flags) moved to `src/core/controllers/gesture-controller.ts`. Engine reads `gesture.isDragging` via a getter; `forceClearDragState()` exposed for destroy-mid-drag rollback.
- **AriaSliderWriter extracted** — ARIA `valuemin/max/now/valuetext` attribute writes encapsulated in `src/core/primitives/aria-slider-writer.ts`. Engine owns trigger points; writer owns attribute names and the empty-list strip branch.
- **TeardownStack consolidation** — 8 destroy-only `detachX/releaseX` named fields replaced by a single `teardowns` LIFO stack with per-fn error isolation. Built-in plugins (`installPersist`, `installAutoCollapse`, `installRoute`) AND user `engine.use(plugin)` teardowns now share the same stack — single drain, single error model. Drain rethrows via `queueMicrotask`.
- **`hot-path-thresholds.ts`** primitive — `OPACITY_WRITE_EPSILON` / `SIZE_WRITE_EPSILON` / `POINTER_EVENTS_OPACITY_THRESHOLD` / `RANGE_DIVISION_EPSILON` centralized. Engine + ScrimController import from one place; eliminates drift risk between hot-path consumers.
- **`setScrim()` batch fix** — inner setters (`setScrimMode`, `setScrimEnabled`, `setScrimTapToClose`) now receive a noop callback so `applySize()` runs exactly once per batch instead of up to three times.
- **Drag payload pooling** — `"drag"` event payload is a single reused `{size, delta}` object, mutated each `onMove` instead of allocated per frame. Eliminates ~32B × 60-120Hz GC churn during long drags. Consumers MUST NOT retain the payload reference across frames — clone if persistence needed (mirrors browser PointerEvent semantics). JSDoc on `SheetEventMap.drag` documents the contract.

### Fixed

- **`returnFocus` double-fire on overlay destroy** — `LifecycleController.release()` now short-circuits when not installed, preventing focus restoration from firing twice on `close() → destroy()`. New `installed` / `destroyed` flags seal the controller post-destroy; `setReturnFocus()` after destroy is a no-op.
- **Vue adapter — `state` exposed as readonly** — `defineExpose({ state: readonly(state) })` prevents external write-through that would desync the local view-state from the engine. Mirrors React's getter and Svelte's `getState()` snapshot pattern.
- **`engine.use()` plugin install error isolation** — throws from `plugin.install()` are now caught and rethrown via `queueMicrotask`, so a buggy plugin can't take the engine down with it. Sibling plugins continue to install; the error surfaces in dev tools on the next tick.
- iCloud-Drive duplicate files (`name 2.ext`) stripped from `dist/` via postbuild script.
- Svelte adapter: `aria-modal` toggling and slider `aria-valuemin/max/now` static defaults.
- Vite demo: `optimizeDeps.exclude` for CDN-loaded benchmark libs.

### Tests

- **Cross-adapter contract anchor** (`tests/unit/adapter-contract.test.ts`) — single source of truth `EXPECTED_STATE_KEYS` + `EXPECTED_REF_API` asserted against engine/Vue/React/Solid/Svelte/Web Component/Qwik. Adding a field to `EngineState` fails this test if any adapter forgets to mirror it.
- **Hot-path threshold regressions** (`tests/unit/hot-path-thresholds.test.ts`) — guards `--bs-size`, `--bs-progress`, and backdrop `pointer-events` dedup gates against silent removal during refactors.
- **`returnFocus` single-fire invariant** + plugin transactional rollback + drag payload identity — regression tests on the bug-fix paths above.

## [0.1.0] — initial commit

### Added — Core engine

- `BottomSheetEngine` class — headless, framework-agnostic spring-physics
  sheet with snap-point math, gesture handling, focus trap, scroll lock,
  inert siblings, history integration (`closeOnBack`), and reduced-motion
  support.
- Cycle invariant via `AbortController`: every async path captures the
  current signal at entry and short-circuits if a newer cycle aborted it.
- Modes: `bottom`, `top`, `left`, `right` with axis-correct transform
  templates compiled once in the constructor.
- Snap-point types: `number`, `${number}%`, `'fit'`, `'full'`, and any
  CSS length string (`50dvh`, `clamp(200px, 60%, 800px)`).
- Spring (RK4 integrator with 240 Hz sub-stepping, single DOM write per
  rAF) and tween (eased) animations with named animation presets.
- WCAG 2.1 AA keyboard slider on the handle (`role=slider`,
  `aria-valuemin/max/now`, arrow / Home / End / PageUp / PageDown).
- CSS custom properties: `--bs-progress` (0..1) and `--bs-size` (px) for
  CSS-driven choreography without JS frame work.

### Added — Features (composable `installX` / `createX` factories)

- `installAutoCollapse`, `installContentSwipe`, `installInertSiblings`
- `installLinkedSheets`, `installPersist`, `installRoute`
- `installScrollCache`, `installSliderKeyboard`, `installSoftKeyboard`
- `installResizeObserver`, `installVisualViewport`
- `createSheetManager` — typed route-based sheet registry.
- `sheetStack` — cross-sheet z/scroll-lock coordination.

### Added — Adapters

- React, Vue 3, Svelte 5, Solid, Qwik, Preact, Lit, and a Custom Element
  (`<bottom-sheet>`) auto-registering via the `/element` subpath.
- Form integrations: `/integrations/formik` and
  `/integrations/react-hook-form` (React-only).

### Added — Standalone overlay

- `@surdeddd/bottom-sheet/overlay` subpath: `OverlayEngine`, a slide-up
  panel without snap-point physics (~4 KB gzip).

### Added — Build & tooling

- Multi-entry tsup build with curated `sideEffects` array (literal paths,
  no globs) for tree-shaking.
- Separate IIFE bundle (`element.iife.global.js`) for CDN drop-in usage.
- 253 unit tests (vitest + happy-dom) and 32 e2e tests (Playwright on
  `mobile-chrome`) covering every adapter, a11y (axe-core), pull-to-
  refresh, soft keyboard, viewport resize, and a head-to-head benchmark
  against vaul and react-modal-sheet.
- CI matrix on Node 18 / 20 / 22.
