# Demo Beauty Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the demo page into an awwwards-level editorial experience: live draggable sheet in the hero, scroll-reveal motion system, polished controls and details — without breaking any existing functionality.

**Architecture:** All changes inside `demo/`. New logic in two small modules (`demo/lib/reveal.ts`, `demo/lib/hero-sheet.ts`) wired from `demo/main.ts`. Styling is a surgical evolution of `demo/style.css`: new blocks appended + a handful of exact-rule replacements. The library `.bs-*` base styles (top of `style.css`) are untouched. Spec: `docs/superpowers/specs/2026-07-24-demo-beauty-redesign-design.md`.

**Tech Stack:** Vite 5 dev/build, vanilla TS, vitest + happy-dom for unit tests, Playwright for visual verification.

## Global Constraints

- Do NOT modify anything under `src/` (the library) or `demo/fixtures/`.
- Keep every existing `id`, `data-i18n` key and JS-hooked class in `demo/index.html` — `demo/main.ts` and `demo/lib/*.ts` query them.
- Keep these e2e hooks working: `.device-wrap`, `.adapter-row`, `#theme-toggle`, `#lang-toggle`, `.device-screen[data-screen="react"] .bs-sheet`, `#snap-chips button`.
- Do NOT give `.adapter-row` a `data-reveal` attribute (it is captured in a clipped visual-regression screenshot before it can intersect the viewport).
- All motion must be inert under `prefers-reduced-motion` and absent without JS (reveal classes are added by JS only).
- i18n: every new user-visible string needs both `en` and `ru` entries in `demo/lib/i18n.ts` DICT.
- House rule: `git commit` steps run ONLY after explicit user confirmation. They are listed for completeness; skip them otherwise.

---

### Task 1: Motion foundation — `reveal.ts` + CSS + wiring

**Files:**
- Create: `demo/lib/reveal.ts`
- Create: `tests/unit/demo-reveal.test.ts`
- Modify: `demo/main.ts` (add import + one call)
- Modify: `demo/style.css` (append reveal block; delete old load-animation block)
- Modify: `demo/index.html` (add `data-reveal` attributes)

**Interfaces:**
- Produces: `initReveal(root?: ParentNode): void` — called once from `main.ts`. `data-reveal` (empty) marks an element; `data-reveal="N"` (N≥1) adds `--reveal-delay: N*60ms`. CSS hooks: `.reveal`, `.reveal.is-revealed`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/demo-reveal.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initReveal } from "../../demo/lib/reveal";

type IOCallback = (
  entries: Array<Partial<IntersectionObserverEntry>>,
) => void;

let lastCb: IOCallback | null = null;
let observed: Element[];

class FakeIO {
  constructor(cb: IOCallback) {
    lastCb = cb;
  }
  observe(el: Element) {
    observed.push(el);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  document.body.innerHTML = "";
  lastCb = null;
  observed = [];
  vi.stubGlobal("IntersectionObserver", FakeIO);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

describe("initReveal", () => {
  it("marks elements with .reveal and observes them, stagger sets delay", () => {
    document.body.innerHTML = `<section data-reveal></section><section data-reveal="2"></section>`;
    initReveal(document);
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    expect(els[0]!.classList.contains("reveal")).toBe(true);
    expect(observed).toHaveLength(2);
    expect(els[1]!.style.getPropertyValue("--reveal-delay")).toBe("120ms");
  });

  it("adds .is-revealed on intersection", () => {
    document.body.innerHTML = `<section data-reveal></section>`;
    initReveal(document);
    const el = document.querySelector("[data-reveal]")!;
    lastCb?.([{ isIntersecting: true, target: el }]);
    expect(el.classList.contains("is-revealed")).toBe(true);
  });

  it("does not mark anything when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    document.body.innerHTML = `<section data-reveal></section>`;
    initReveal(document);
    expect(
      document.querySelector("[data-reveal]")!.classList.contains("reveal"),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/demo-reveal.test.ts`
Expected: FAIL — `Cannot find module '../../demo/lib/reveal'`

- [ ] **Step 3: Implement `demo/lib/reveal.ts`**

```ts
const STAGGER_STEP_MS = 60;

/**
 * One-shot scroll-reveal: elements carrying [data-reveal] get .reveal (hidden,
 * shifted) and reveal on intersection. No-JS / reduced-motion / no-IO → no
 * classes are added, content stays fully visible.
 */
export const initReveal = (root: ParentNode = document): void => {
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (els.length === 0) return;

  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof IntersectionObserver !== "function") return;

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add("is-revealed");
        io.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
  );

  for (const el of els) {
    const stagger = Number(el.dataset.reveal ?? 0);
    if (stagger > 0) {
      el.style.setProperty("--reveal-delay", `${stagger * STAGGER_STEP_MS}ms`);
    }
    el.classList.add("reveal");
    io.observe(el);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/demo-reveal.test.ts`
Expected: 3 passed

- [ ] **Step 5: CSS — append reveal block**

Append to `demo/style.css` (near the existing `@keyframes fadeInUp` block is fine, or end of file):

```css
/* ——— scroll reveal (JS adds .reveal; no-JS stays visible) ——— */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 0.7s ease var(--reveal-delay, 0ms),
    transform 0.7s cubic-bezier(0.2, 0.8, 0.3, 1) var(--reveal-delay, 0ms);
  will-change: opacity, transform;
}
.reveal.is-revealed {
  opacity: 1;
  transform: none;
  will-change: auto;
}
```

- [ ] **Step 6: CSS — delete the old load-time section animation**

In `demo/style.css` remove this exact block (currently lines ~1789-1803):

```css
.adapter-row,.showcase,.controls,.features {
  animation:fadeInUp .7s cubic-bezier(.2,.8,.3,1) both
}
.adapter-row {
  animation-delay:.08s
}
.showcase {
  animation-delay:.16s
}
.controls {
  animation-delay:.24s
}
.features {
  animation-delay:.32s
}
```

Keep `@keyframes fadeInUp` (hero uses it) and keep the global
`@media (prefers-reduced-motion: reduce)` block.

- [ ] **Step 7: HTML — add `data-reveal` attributes in `demo/index.html`**

- `<section class="showcase">` → `<section class="showcase" data-reveal>`
- `<section class="controls">` → `<section class="controls" data-reveal>`
- `<section class="advanced">` → `<section class="advanced" data-reveal>`
- `<header class="features-head">` → `<header class="features-head" data-reveal>`
- Each `<article class="feature">` → add `data-reveal="1"` … `"4"` cycling across
  the 12 articles in order (`1,2,3,4,1,2,3,4,1,2,3,4`) for row stagger
- `<footer class="footer">` → `<footer class="footer" data-reveal>`
- Do NOT add `data-reveal` to `.adapter-row`, `.hero`, `.stage` (see Global
  Constraints).

- [ ] **Step 8: Wire in `demo/main.ts`**

Add to the import block:

```ts
import { initReveal } from "./lib/reveal";
```

Call at the very end of the file (after `mountAdapter(activeAdapter);`):

```ts
initReveal();
```

- [ ] **Step 9: Verify**

Run: `npm run demo:build && npx vitest run tests/unit/demo-reveal.test.ts`
Expected: build succeeds, 3 tests pass. Manual: dev server, scroll — sections
rise in once.

- [ ] **Step 10: Commit (only with user confirmation)**

```bash
git add demo/lib/reveal.ts tests/unit/demo-reveal.test.ts demo/main.ts demo/style.css demo/index.html
git commit -m "demo: scroll-reveal motion foundation"
```

---

### Task 2: Hero stage — markup and styles (static)

**Files:**
- Modify: `demo/index.html` (insert stage inside `.hero`, after `.hero-stats`)
- Modify: `demo/style.css` (append stage block; edit `.hero` border)
- Modify: `demo/lib/i18n.ts` (4 new keys × 2 langs — `stage.cap`, `stage.hint`; the `sec.*` and `install.*` keys land in Task 6)

**Interfaces:**
- Produces: `#stage-sheet-host` (mount target for Task 3), `#stage-hint` (dismissed by Task 3), `.stage-viewport` containment context where `.bs-sheet`/`.bs-backdrop` become `position:absolute`.

- [ ] **Step 1: i18n keys**

In `demo/lib/i18n.ts`, add to the `en` dict (after `"hero.lede"` line group is fine):

```ts
    "stage.cap": "fig. 01 — live · the sheet is real, drag it",
    "stage.hint": "↓ drag the handle",
```

Add to the `ru` dict:

```ts
    "stage.cap": "рис. 01 — живьём · шторка настоящая, потяните",
    "stage.hint": "↓ потяните за ручку",
```

- [ ] **Step 2: HTML — insert the stage**

In `demo/index.html`, immediately after the closing `</div>` of
`<div class="hero-stats">…</div>` and before `</header>`, insert:

```html
      <div class="stage" id="hero-stage">
        <div class="stage-cap">
          <span class="mono" data-i18n="stage.cap"
            >fig. 01 — live · the sheet is real, drag it</span
          >
          <span class="stage-hint mono" id="stage-hint" data-i18n="stage.hint"
            >↓ drag the handle</span
          >
        </div>
        <div class="stage-viewport" id="stage-viewport">
          <div class="stage-scene" aria-hidden="true">
            <div class="stage-scene-head">
              <span class="stage-scene-kicker">Fleet Atlas · dispatch</span>
              <span class="stage-scene-title">Central Europe corridor</span>
            </div>
            <div class="stage-scene-card stage-scene-card-a">
              <span class="stage-scene-card-num">247</span>
              <span class="stage-scene-card-label">active vehicles</span>
            </div>
            <div class="stage-scene-card stage-scene-card-b">
              <span class="stage-scene-card-num">98.2%</span>
              <span class="stage-scene-card-label">on-time</span>
            </div>
          </div>
          <div class="stage-sheet-host" id="stage-sheet-host"></div>
        </div>
      </div>
```

- [ ] **Step 3: CSS — append stage block**

Append to `demo/style.css`:

```css
/* ——— hero stage: live sheet on the first screen ——— */
.stage {
  margin-top: 56px;
}
.stage-cap {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  padding: 10px 2px;
  border-top: 1px solid var(--hairline-strong);
  border-bottom: 1px solid var(--hairline);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.stage-hint {
  color: var(--vermillion);
  animation: stageHint 2.4s ease-in-out infinite;
  transition: opacity 0.5s ease;
}
.stage-hint.is-done {
  opacity: 0;
  animation: none;
}
@keyframes stageHint {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}
.stage-viewport {
  position: relative;
  height: clamp(440px, 52vw, 600px);
  overflow: hidden;
  contain: layout paint;
  isolation: isolate;
}
.stage-scene {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 25% 15%, rgba(220, 53, 34, 0.16), transparent 45%),
    radial-gradient(circle at 80% 85%, rgba(80, 110, 140, 0.2), transparent 55%),
    linear-gradient(180deg, #1f2933, #0e1418);
  color: #f4ede0;
}
.stage-scene-head {
  position: absolute;
  top: 36px;
  left: 40px;
  right: 40px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stage-scene-kicker {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #dc3522f2;
}
.stage-scene-title {
  font-family: var(--serif);
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 300;
  font-style: italic;
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.stage-scene-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 22px;
  background: rgba(255, 250, 240, 0.06);
  border: 1px solid rgba(255, 250, 240, 0.12);
  border-radius: 16px;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.stage-scene-card-a { top: 34%; left: 40px; }
.stage-scene-card-b { top: 26%; right: 48px; }
.stage-scene-card-num {
  font-family: var(--serif);
  font-size: 40px;
  font-weight: 300;
  letter-spacing: -0.03em;
  line-height: 1;
}
.stage-scene-card-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 250, 240, 0.6);
}
.stage-sheet-host {
  position: absolute;
  inset: 0;
}
/* engine containment — same trick as .device-frame */
.stage-viewport .bs-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.stage-viewport .bs-sheet,
.stage-viewport .bs-backdrop {
  position: absolute !important;
}
.stage-viewport .bs-sheet {
  max-width: 560px;
  margin: 0 auto;
  border-left: 1px solid var(--bs-surface-border);
  border-right: 1px solid var(--bs-surface-border);
}
@media (max-width: 720px) {
  .stage { margin-top: 40px; }
  .stage-viewport { height: 440px; }
  .stage-scene-head { top: 24px; left: 24px; right: 24px; }
  .stage-scene-card-a { left: 24px; }
  .stage-scene-card-b { right: 24px; }
  .stage-viewport .bs-sheet { max-width: 100%; }
}
```

- [ ] **Step 4: CSS — let the stage own the hero's bottom hairline**

In `demo/style.css` find the `.hero` rule and remove the line
`border-bottom:1px solid var(--hairline-strong);` from it (the
`.stage-viewport` + `.adapter-row` lines now carry the separation). Keep
everything else in `.hero`.

- [ ] **Step 5: Verify visually**

Dev server (`npm run demo`, port 5173): stage renders with dark scene, two
glass cards, empty sheet host. `npm run demo:build` passes. Screenshot the
hero region and eyeball both themes.

- [ ] **Step 6: Commit (only with user confirmation)**

```bash
git add demo/index.html demo/style.css demo/lib/i18n.ts
git commit -m "demo: hero stage markup and styling"
```

---

### Task 3: Live engine in the hero — `hero-sheet.ts`

**Files:**
- Create: `demo/lib/hero-sheet.ts`
- Create: `tests/unit/demo-hero-sheet.test.ts`
- Modify: `vitest.config.ts` (add exact-match alias)
- Modify: `demo/main.ts` (mount)

**Interfaces:**
- Consumes: `BottomSheetEngine` from `@surdeddd/bottom-sheet`; `buildItem`, `demoRows` from `demo/apps/shared.ts`.
- Produces: `mountHeroSheet(host: HTMLElement): () => void` — mounts a `.bs-root` with a draggable sheet into `host`, returns a cleanup. On any failure hides the closest `.stage` ancestor and returns a noop.

- [ ] **Step 1: vitest alias for the bare package specifier**

In `vitest.config.ts` add (imports `resolve` from `node:path`):

```ts
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@surdeddd\/bottom-sheet$/,
        replacement: resolve(__dirname, "src/index.ts"),
      },
    ],
  },
  test: {
    // …unchanged…
  },
});
```

The regex matches ONLY the bare specifier — subpath imports
(`@surdeddd/bottom-sheet/react` etc.) and existing relative `../../src/...`
imports are unaffected.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/demo-hero-sheet.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { mountHeroSheet } from "../../demo/lib/hero-sheet";

describe("mountHeroSheet", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts a sheet into the host and cleans up", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const destroy = mountHeroSheet(host);
    expect(host.querySelector(".bs-root")).toBeTruthy();
    expect(host.querySelector(".bs-sheet")).toBeTruthy();
    expect(host.querySelectorAll(".sheet-item")).toHaveLength(6);
    destroy();
    expect(host.querySelector(".bs-root")).toBeNull();
  });

  it("hides the stage and returns a noop on failure", () => {
    const stage = document.createElement("div");
    stage.className = "stage";
    const host = document.createElement("div");
    stage.append(host);
    document.body.append(stage);
    host.append = () => {
      throw new Error("boom");
    };
    const destroy = mountHeroSheet(host);
    expect(stage.hasAttribute("hidden")).toBe(true);
    expect(() => destroy()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/demo-hero-sheet.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `demo/lib/hero-sheet.ts`**

```ts
import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { buildItem, demoRows } from "../apps/shared";

/**
 * Mounts a real, draggable sheet into the hero stage. Page-safe: no focus
 * trap, no Esc close, no body scroll lock. Any failure hides the stage so the
 * rest of the page is unaffected.
 */
export const mountHeroSheet = (host: HTMLElement): (() => void) => {
  try {
    const root = document.createElement("div");
    root.className = "bs-root";

    const sheet = document.createElement("section");
    sheet.className = "bs-sheet";
    sheet.dataset.mode = "bottom";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "Live demo sheet");

    const handle = document.createElement("div");
    handle.className = "bs-handle";
    handle.setAttribute("role", "slider");
    handle.setAttribute("tabindex", "0");
    handle.setAttribute("aria-label", "Resize sheet");

    const header = document.createElement("div");
    header.className = "sheet-header";
    const h2 = document.createElement("h2");
    h2.textContent = "Active routes";
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "LIVE · ENGINE";
    header.append(h2, hint);
    handle.append(header);

    const content = document.createElement("div");
    content.className = "bs-content";
    content.setAttribute("tabindex", "0");
    content.setAttribute("role", "region");
    content.setAttribute("aria-label", "Sheet content");
    for (const [title, sub] of demoRows.slice(0, 6)) {
      content.append(buildItem(title, sub));
    }

    sheet.append(handle, content);
    root.append(sheet);
    host.append(root);

    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      mode: "bottom",
      snapPoints: [
        { id: "peek", size: 76 },
        { id: "half", size: "48%" },
        { id: "full", size: "92%" },
      ],
      allowed: ["peek", "half", "full"],
      initial: "peek",
      animation: "spring",
      spring: { stiffness: 260, damping: 28 },
      focusTrap: false,
      closeOnEscape: false,
      rubberBand: true,
      lockBodyScroll: false,
    });

    const hintEl = document.getElementById("stage-hint");
    handle.addEventListener(
      "pointerdown",
      () => hintEl?.classList.add("is-done"),
      { once: true },
    );

    return () => {
      engine.destroy();
      root.remove();
    };
  } catch {
    host.closest(".stage")?.setAttribute("hidden", "");
    return () => {};
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/demo-hero-sheet.test.ts`
Expected: 2 passed

- [ ] **Step 6: Wire in `demo/main.ts`**

Add import:

```ts
import { mountHeroSheet } from "./lib/hero-sheet";
```

At the end of the file (before or after `initReveal();`, order irrelevant):

```ts
const stageHost = document.querySelector<HTMLElement>("#stage-sheet-host");
if (stageHost) mountHeroSheet(stageHost);
```

- [ ] **Step 7: Verify manually**

Dev server: hero sheet sits at `peek`, drags with spring, snaps at
peek/half/full, hint fades after first pointerdown, Esc does nothing, page
scroll unaffected, both themes OK, `npm run demo:build` passes. Screenshot.

- [ ] **Step 8: Commit (only with user confirmation)**

```bash
git add demo/lib/hero-sheet.ts tests/unit/demo-hero-sheet.test.ts vitest.config.ts demo/main.ts
git commit -m "demo: live draggable sheet in hero stage"
```

---

### Task 4: Hero entrance choreography

**Files:**
- Modify: `demo/index.html` (wrap title lines)
- Modify: `demo/style.css` (edit `.hero`, `.title-line`; append entrance block)

**Interfaces:**
- Produces: `.title-line > .title-inner` structure; CSS-only entrance (no JS). End state must be fully visible — visual-regression uses `animations: "disabled"`, which fast-forwards CSS animations to their end state.

- [ ] **Step 1: HTML — wrap title lines**

In `demo/index.html` replace:

```html
        <span class="title-line">@surdeddd/</span>
        <span class="title-line title-italic">bottom-sheet</span>
```

with:

```html
        <span class="title-line"><span class="title-inner">@surdeddd/</span></span>
        <span class="title-line title-italic"><span class="title-inner">bottom-sheet</span></span>
```

- [ ] **Step 2: CSS — remove hero-level animation**

In the `.hero` rule, remove `animation:fadeInUp .6s cubic-bezier(.2,.8,.3,1) both`.

- [ ] **Step 3: CSS — mask the title lines**

In the `.title-line` rule (currently `display:block`), change to:

```css
.title-line {
  display:block;
  overflow:hidden
}
```

- [ ] **Step 4: CSS — append entrance block**

```css
/* ——— hero entrance ——— */
.title-inner {
  display: block;
  transform: translateY(112%);
  animation: titleRise 1s cubic-bezier(0.2, 0.8, 0.3, 1) 0.05s forwards;
}
.title-line.title-italic .title-inner {
  animation-delay: 0.18s;
}
@keyframes titleRise {
  to { transform: translateY(0); }
}
.hero-meta,
.hero-lede,
.hero-stats {
  animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
.hero-meta { animation-delay: 0.02s; }
.hero-lede { animation-delay: 0.32s; }
.hero-stats { animation-delay: 0.48s; }
.stage {
  animation: fadeInUp 0.9s cubic-bezier(0.2, 0.8, 0.3, 1) 0.6s both;
}
```

(The `.stage` rule above extends the one from Task 2 — add the `animation`
line to the existing `.stage` rule instead of duplicating the selector.)

- [ ] **Step 5: Verify**

Reload dev server: title lines rise from masks, lede/stats/stage cascade.
Reduced-motion: everything appears instantly. Screenshots at t≈1.5s show the
final state. `npm run demo:build` passes.

- [ ] **Step 6: Commit (only with user confirmation)**

```bash
git add demo/index.html demo/style.css
git commit -m "demo: hero entrance choreography"
```

---

### Task 5: Custom sliders and switch toggles

**Files:**
- Modify: `demo/style.css` (replace two exact rules)

**Interfaces:**
- Produces: restyled `input[type=range]` inside `.slider` and `input[type=checkbox]` inside `.toggle`. No HTML/JS changes — same elements, same semantics.

- [ ] **Step 1: Replace the slider rule**

In `demo/style.css` replace:

```css
.slider input[type=range] {
  width:100%;
  accent-color:var(--vermillion)
}
```

with:

```css
.slider input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 22px;
  background: transparent;
  cursor: pointer;
  margin: 0;
}
.slider input[type=range]::-webkit-slider-runnable-track {
  height: 2px;
  background: var(--hairline-strong);
  border-radius: 2px;
}
.slider input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -7px;
  border-radius: 50%;
  background: var(--vermillion);
  border: 3px solid #f4ede0;
  box-shadow: 0 1px 4px rgba(26, 22, 20, 0.35);
  transition: transform 0.15s ease;
}
.slider input[type=range]:hover::-webkit-slider-thumb,
.slider input[type=range]:focus-visible::-webkit-slider-thumb {
  transform: scale(1.2);
}
.slider input[type=range]::-moz-range-track {
  height: 2px;
  background: var(--hairline-strong);
  border-radius: 2px;
}
.slider input[type=range]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--vermillion);
  border: 3px solid #f4ede0;
  box-shadow: 0 1px 4px rgba(26, 22, 20, 0.35);
  transition: transform 0.15s ease;
}
.slider input[type=range]:hover::-moz-range-thumb {
  transform: scale(1.2);
}
.slider input[type=range]:focus-visible {
  outline: 2px solid var(--vermillion);
  outline-offset: 4px;
  border-radius: 4px;
}
```

- [ ] **Step 2: Replace the toggle rule**

Replace:

```css
.toggle input {
  accent-color:var(--vermillion);
  width:16px;
  height:16px
}
```

with:

```css
.toggle input[type=checkbox] {
  -webkit-appearance: none;
  appearance: none;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: var(--hairline-strong);
  position: relative;
  cursor: pointer;
  margin: 0;
  flex-shrink: 0;
  transition: background 0.2s ease;
}
.toggle input[type=checkbox]::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f4ede0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.toggle input[type=checkbox]:checked {
  background: var(--vermillion);
}
.toggle input[type=checkbox]:checked::before {
  transform: translateX(16px);
}
.toggle input[type=checkbox]:focus-visible {
  outline: 2px solid var(--vermillion);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Verify**

Controls section: sliders show hairline track + vermillion knob (grows on
hover/focus); toggles are switches that slide. All toggles still flip engine
flags (click each: trap/esc/haptic/rubber, scrim toggles, floating UI
toggles). Keyboard: Tab to a switch, Space toggles. Screenshots light+dark.

- [ ] **Step 4: Commit (only with user confirmation)**

```bash
git add demo/style.css
git commit -m "demo: custom sliders and switch toggles"
```

---

### Task 6: Section captions, hover accents, footer copy

**Files:**
- Modify: `demo/index.html` (4 caption divs; footer install row)
- Modify: `demo/style.css` (append caption/accent/install blocks; small rule edits)
- Modify: `demo/lib/i18n.ts` (6 keys × 2 langs)
- Modify: `demo/main.ts` (install-copy wiring + `t` import)

**Interfaces:**
- Produces: `.sec-cap` divider rows; `#install-copy` button with `#install-copy-label` span; i18n keys `sec.demo`, `sec.controls`, `sec.advanced`, `sec.features`, `install.copy`, `install.copied`.

- [ ] **Step 1: i18n keys**

Add to `en` dict:

```ts
    "sec.demo": "§ 01 — the device",
    "sec.controls": "§ 02 — playground",
    "sec.advanced": "§ 03 — advanced",
    "sec.features": "§ 04 — what's inside",
    "install.copy": "copy",
    "install.copied": "copied",
```

Add to `ru` dict:

```ts
    "sec.demo": "§ 01 — устройство",
    "sec.controls": "§ 02 — площадка",
    "sec.advanced": "§ 03 — расширенное",
    "sec.features": "§ 04 — что внутри",
    "install.copy": "копировать",
    "install.copied": "скопировано",
```

- [ ] **Step 2: HTML — caption rows**

Insert before `<section class="showcase" …>`:

```html
    <div class="sec-cap" data-reveal>
      <span data-i18n="sec.demo">§ 01 — the device</span>
    </div>
```

Before `<section class="controls" …>`:

```html
    <div class="sec-cap" data-reveal>
      <span data-i18n="sec.controls">§ 02 — playground</span>
    </div>
```

Before `<section class="advanced" …>`:

```html
    <div class="sec-cap" data-reveal>
      <span data-i18n="sec.advanced">§ 03 — advanced</span>
    </div>
```

Before `<section class="features">`:

```html
    <div class="sec-cap" data-reveal>
      <span data-i18n="sec.features">§ 04 — what's inside</span>
    </div>
```

- [ ] **Step 3: HTML — footer install row**

Replace:

```html
      <pre class="install mono">$ npm i @surdeddd/bottom-sheet</pre>
```

with:

```html
      <div class="install-row">
        <pre class="install mono">$ npm i @surdeddd/bottom-sheet</pre>
        <button
          type="button"
          id="install-copy"
          class="topbar-btn install-copy"
          aria-label="Copy install command"
        >
          <span id="install-copy-label" data-i18n="install.copy">copy</span>
        </button>
      </div>
```

- [ ] **Step 4: CSS — append blocks**

```css
/* ——— section captions ——— */
.sec-cap {
  max-width: 1320px;
  margin: 0 auto;
  padding: 20px 48px 0;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
}
.sec-cap span {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.sec-cap span::before {
  content: "";
  width: 32px;
  height: 1px;
  background: var(--vermillion);
}

/* ——— feature hover accent ——— */
.feature::after {
  content: "";
  position: absolute;
  left: 0;
  top: -1px;
  width: 100%;
  height: 2px;
  background: var(--vermillion);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.feature:hover::after {
  transform: scaleX(1);
}

/* ——— chip press + focus rings ——— */
.chip:active {
  transform: scale(0.95);
}
.chip:focus-visible,
.adapter:focus-visible,
.advanced-btn:focus-visible {
  outline: 2px solid var(--vermillion);
  outline-offset: 2px;
}

/* ——— footer install copy ——— */
.install-row {
  position: relative;
  max-width: 100%;
}
.install-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 5px 12px;
}
@media (max-width: 720px) {
  .sec-cap { padding: 16px 24px 0; }
}
@media (max-width: 480px) {
  .sec-cap { padding: 14px 16px 0; }
}
```

Also extend the existing `.chip` rule's `transition:all .15s` — leave as is
(`all` already covers `transform`); no edit needed.

- [ ] **Step 5: JS — wire the copy button**

In `demo/main.ts` extend the i18n import to include `t`:

```ts
import { applyLang, getLang, t, wireLangToggle } from "./lib/i18n";
```

Append near the end (before `initReveal();` is fine):

```ts
$<HTMLButtonElement>("#install-copy")?.addEventListener("click", async () => {
  const label = $<HTMLElement>("#install-copy-label");
  try {
    await navigator.clipboard.writeText("npm i @surdeddd/bottom-sheet");
    if (label) label.textContent = t("install.copied");
  } catch {
    if (label) label.textContent = "failed";
  }
  window.setTimeout(() => {
    if (label) label.textContent = t("install.copy");
  }, 1400);
});
```

- [ ] **Step 6: Verify**

Captions render with red tick; feature cards grow a vermillion top accent on
hover; chips compress on press; footer copy button copies and flips label in
EN and RU. `npm run demo:build` passes. Screenshots.

- [ ] **Step 7: Commit (only with user confirmation)**

```bash
git add demo/index.html demo/style.css demo/lib/i18n.ts demo/main.ts
git commit -m "demo: section captions, hover accents, install copy"
```

---

### Task 7: View-transition polish

**Files:**
- Modify: `demo/style.css` (append block)

**Interfaces:**
- Produces: custom `::view-transition-old/new(root)` animations. The existing `startViewTransition` (used by adapter switches and the lang toggle) already gates reduced-motion and no-API fallbacks — no JS changes.

- [ ] **Step 1: Append CSS**

```css
/* ——— view transitions (adapter / language switch) ——— */
::view-transition-old(root) {
  animation: vt-root-out 0.22s ease both;
}
::view-transition-new(root) {
  animation: vt-root-in 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
@keyframes vt-root-out {
  to { opacity: 0; transform: translateY(8px); }
}
@keyframes vt-root-in {
  from { opacity: 0; transform: translateY(-8px); }
}
```

- [ ] **Step 2: Verify**

Click between adapters and EN/RU: page crossfades with a subtle vertical
shift (Chromium). Reduced-motion: instant swap. `npm run demo:build` passes.

- [ ] **Step 3: Commit (only with user confirmation)**

```bash
git add demo/style.css
git commit -m "demo: view-transition polish"
```

---

### Task 8: Verification pass

**Files:**
- Regenerate: `tests/e2e/visual-regression.spec.ts-snapshots/**` (via `--update-snapshots`, only with user confirmation since it overwrites baselines)

- [ ] **Step 1: Build**

Run: `npm run demo:build`
Expected: success, no TS/CSS errors.

- [ ] **Step 2: Unit suite**

Run: `npm test`
Expected: all green, including `demo-reveal` and `demo-hero-sheet`.

- [ ] **Step 3: Lint/types (project standard)**

Run: `npx tsc --noEmit` (or the repo's typecheck script if defined — check `package.json` scripts first)
Expected: clean.

- [ ] **Step 4: E2E sanity (fixtures must be unaffected)**

Run: `npx playwright test --project=mobile-chrome tests/e2e/sheet.spec.ts tests/e2e/adapters.spec.ts`
Expected: green (these run against `demo/fixtures/`, untouched).

- [ ] **Step 5: Visual regression — regenerate and eyeball**

Run: `npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots`
Then `git diff --stat` the snapshot dir and open at least
`hero-and-adapters.png` (visual-1280) and one mobile variant to confirm the
stage renders and the adapter row is visible (not stuck at opacity 0).

- [ ] **Step 6: Manual screenshot matrix**

With the dev server running, capture via a throwaway Playwright script (do
not commit it): hero, showcase, controls, advanced, features, footer ×
light/dark × 1440/390 × EN/RU spot-checks; keyboard-only pass (Tab order
reaches hero sheet handle, ↑↓ resizes it); `prefers-reduced-motion` emulation
(`page.emulateMedia({ reducedMotion: "reduce" })`) shows all content with no
motion. Read the screenshots back and fix visual defects before claiming done.

## Self-review notes

- Spec coverage: §1 hero takeover → Tasks 2-3; §2 motion → Tasks 1, 4, 7
  (adapter-switch transition already existed via `startViewTransition` — this
  plan styles it); §3 polish → Tasks 4-6; §4 files → all rows mapped; §5
  verification → Task 8.
- Readout "smooth numbers" from the spec is intentionally dropped: values
  update at ~30 Hz, tweening would smear; `font-variant-numeric: tabular-nums`
  is already in place (style.css line ~789).
- Type consistency: `initReveal(root?: ParentNode): void`,
  `mountHeroSheet(host: HTMLElement): () => void`, i18n keys listed once in
  Task 2 / Task 6 and referenced identically in HTML.
