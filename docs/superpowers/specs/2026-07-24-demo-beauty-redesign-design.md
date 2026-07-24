# Demo Beauty Redesign — "Editorial, Evolved"

- **Date:** 2026-07-24
- **Status:** approved (design), pending implementation
- **Scope:** `demo/` only — no library (`src/`) changes

## Context

The demo page (`demo/index.html` + `demo/style.css` + `demo/main.ts`) is a
working showcase: editorial magazine styling (Fraunces / Hanken Grotesk /
JetBrains Mono, cream paper, red accent), a phone-bezel live demo with 7
framework adapters, live engine readouts, code snippets, controls, an advanced
playground and a 12-card features grid. It has EN/RU i18n, light/dark themes
and keyboard/ARIA support.

Goal: make it *incredibly beautiful* — awwwards-level polish — while every
existing feature keeps working.

## Approved decisions

- **Direction:** evolve the current editorial identity (not a re-skin).
- **Scope:** visual polish + motion system + one new section (live-sheet hero).
- **New sections:** hero takeover only (no adapter comparison, no use-case
  gallery, no scroll-story guide).
- **Inviolable:** i18n EN/RU, light + dark themes, all 7 adapters, every
  control and the advanced playground, keyboard navigation & a11y.

## Constraints (verified in code)

- E2E fixtures live in `demo/fixtures/` and are independent of the main page.
- `tests/e2e/visual-regression.spec.ts` (separate Playwright project,
  `testMatch`, ignored by default runs) references `.device-wrap`,
  `.adapter-row`, `#theme-toggle`, `#lang-toggle` on the main page. These hooks
  MUST keep existing; snapshots will be regenerated after the restyle.
- All existing `id`s, `data-i18n` keys and JS-hooked classes in
  `demo/index.html` must survive: `main.ts`, `demo/lib/*.ts` and the adapter
  apps query them directly.
- The library base styles (`.bs-*` block at the top of `demo/style.css`) are
  shared with fixtures — leave untouched.

## Design

### 1. Hero takeover — "the product demos itself"

Below the existing masthead (kicker / title / lede / stats — unchanged), add a
**stage**: a wide hairline-framed window with a mono caption
(`fig. 01 — live`). Inside: a miniature app scene (muted gradient + Fleet Atlas
cards) and a **real bottom sheet driven by the vanilla engine** with 3 snap
points and spring physics. Users can drag it on the first screen, before
scrolling to the phone.

- A "drag me" hint with a softly pulsing handle; fades after the first drag.
- The sheet is contained inside the stage (absolute positioning), NOT
  `position: fixed` over the page — zero conflicts with page scroll and a11y.
- Mount is guarded: a hero-sheet failure must not break the rest of the page.

### 2. Motion system

- **Scroll-reveal** for all sections: fade + 24px rise + light child stagger,
  one-shot, via IntersectionObserver. Reveal classes are added by JS only, so
  no-JS stays readable.
- **Hero entrance** on load: title lines rise sequentially, stats follow,
  ~600ms ease-out.
- **Adapter switch:** device screen + code panel crossfade/slide (~250ms).
- **Micro-interactions:** chip press states, feature-card hover (hairline
  accent + lift), smooth number transitions in live readouts.
- Everything disabled under `prefers-reduced-motion`.

### 3. Visual polish

- Modular type scale for Fraunces/Hanken/JetBrains Mono; section rhythm
  140–180px.
- Hairline section dividers with mono captions (`§ 02 — playground`).
- Align the three showcase columns (readouts / device / snippet) on baselines.
- Custom slider tracks/thumbs; real switch toggles instead of native
  checkboxes (same `<input>` semantics, a11y preserved).
- Footer: `$ npm i @surdeddd/bottom-sheet` gains a copy button.
- Dark theme: accent slightly lightened, grain subdued.

### 4. Architecture / files

| File | Change |
| --- | --- |
| `demo/index.html` | add hero stage + section captions; keep every existing hook |
| `demo/style.css` | rewrite the page-specific part (keep the `.bs-*` base block) |
| `demo/main.ts` | mount hero sheet, reveal observer, adapter transition |
| `demo/lib/hero-sheet.ts` | NEW — stage scene + engine wiring + drag hint |
| `demo/lib/reveal.ts` | NEW — IntersectionObserver scroll-reveal |
| `demo/lib/i18n.ts` | new EN+RU keys (stage caption, drag hint, section captions, copy) |

### 5. Verification

- `npm run demo:build` passes.
- Full unit suite (`npm test`) stays green (no src changes expected).
- E2E default suite green; visual-regression snapshots regenerated
  (`--update-snapshots`) and eyeballed.
- Manual screenshot review: every section × light/dark × desktop 1440 /
  mobile 390; EN + RU; keyboard-only pass; reduced-motion pass.

## Risks

- **Restyle regressions in fixtures** — mitigated by not touching the `.bs-*`
  base block.
- **Motion hurting a11y** — mitigated by reduced-motion gating and JS-only
  reveal classes.
- **Scope creep** — one new section only; everything else is polish of what
  exists.
