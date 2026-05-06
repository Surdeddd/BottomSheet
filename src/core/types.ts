/**
 * A snap point can be expressed as:
 *   - number          → pixels
 *   - `${n}%`         → percent of viewport height (or width for side sheets)
 *   - "fit"           → fits to header / measured natural height
 *   - "full"          → 100% of axis
 *   - any CSS length  → resolved via probe element ("50dvh", "min(80dvh, 600px)",
 *                       "clamp(200px, 60%, 800px)", "env(safe-area-inset-bottom)")
 *                       Prefer `dvh` over legacy `vh` — iOS Safari URL bar
 *                       collapse leaves `vh` stale; the engine warns on `vh`.
 */
export type SnapPoint =
  | number
  | `${number}%`
  | "fit"
  | "full"
  | (string & {});

export type SnapPointDef<Id extends string = string> = {
  /** Stable identifier used for `snapTo()` and events. */
  id: Id;
  /** Target size of the sheet in this state. */
  size: SnapPoint;
};

/**
 * Extract the union of `id` literals from a `SnapPointDef[]` (or from an
 * `EngineOptions`-shaped object). For literal inference the consumer must
 * pin the array with `as const`:
 *
 *   const opts = {
 *     snapPoints: [
 *       { id: "min", size: 96 },
 *       { id: "full", size: "85%" },
 *     ] as const,
 *   };
 *   type Id = SnapId<typeof opts.snapPoints>; // "min" | "full"
 *
 * Without `as const` TS widens `id` to `string` and the helper resolves to
 * `string` — no type error, but no narrowing either.
 */
export type SnapId<
  T extends
    | readonly SnapPointDef<string>[]
    | { snapPoints: readonly SnapPointDef<string>[] },
> = T extends { snapPoints: readonly SnapPointDef<infer U>[] }
  ? U
  : T extends readonly SnapPointDef<infer U>[]
    ? U
    : never;

// Aliased to TransformAxis (single source of truth in `transform.ts`) so
// adding a new mode (e.g. "center") propagates through engine + overlay
// without manual sync.
export type SheetMode = import("./primitives/transform").TransformAxis;

/**
 * Named scrim look-and-feel preset. Each preset bundles a `color`, optional
 * `blur`, opacity `range`, and `interactive` default into one value so
 * consumers don't need to remember the underlying scrim fields.
 *
 *   - `subtle`      — light dim, no blur, late fade-in (good for peeks).
 *   - `standard`    — moderate dim, no blur, full-range fade (default-ish).
 *   - `monitoring`  — bluish dim with light blur (dashboard / panel UX).
 *   - `cinematic`   — heavy dim with strong blur (full-attention modal).
 */
export type ScrimPreset = "subtle" | "standard" | "monitoring" | "cinematic";

/** Resolved field set for a `ScrimPreset` — used both at construction and by
 *  `setScrim({ preset })` to layer baseline values under explicit overrides. */
export type ScrimPresetConfig = {
  color: string;
  blur: string | undefined;
  range: [number, number];
  interactive: boolean;
};

/**
 * Frozen so a consumer can't mutate the table at runtime and silently change
 * every engine that uses a preset. Each entry mirrors the `ScrimPresetConfig`
 * fields exactly.
 */
export const SCRIM_PRESETS: Readonly<Record<ScrimPreset, ScrimPresetConfig>> =
  Object.freeze({
    subtle: {
      color: "rgba(0,0,0,0.2)",
      blur: undefined,
      range: [0.3, 1],
      interactive: false,
    },
    standard: {
      color: "rgba(0,0,0,0.4)",
      blur: undefined,
      range: [0, 1],
      interactive: false,
    },
    monitoring: {
      color: "rgba(15,15,20,0.55)",
      blur: "4px",
      range: [0, 1],
      interactive: false,
    },
    cinematic: {
      color: "rgba(0,0,0,0.7)",
      blur: "12px",
      range: [0, 1],
      interactive: false,
    },
  });

/**
 * Batch-update payload for `setScrim`. `null` for `color` / `blur` means
 * "clear the inline style" (i.e. revert to whatever CSS provides); `undefined`
 * means "leave as-is". `preset` is applied first and any sibling field
 * overrides it. A single recompute fires at the end so the per-frame opacity
 * stays consistent.
 *
 * `mode` / `tapToClose` / `enabled` mirror the runtime setters
 * `setScrimMode` / `setScrimTapToClose` / `setScrimEnabled` so consumers can
 * flip a "monitoring on/off" toggle in one call without four separate
 * setters racing each other.
 */
export type ScrimUpdate = {
  color?: string | null;
  blur?: string | null;
  interactive?: boolean;
  range?: [number, number];
  preset?: ScrimPreset;
  mode?: "full" | "above-sheet" | "off";
  tapToClose?: boolean;
  enabled?: boolean;
};

/**
 * Where in the scrim area a `setScrimOverlay` injection sits. The wrapper is
 * `position: absolute` so the consumer's scrim must be a positioning context
 * (the engine writes `position: fixed` on `screenComponent` only when
 * `scrimMode: "above-sheet"` — for `"full"` you must size + position the
 * scrim yourself).
 */
export type ScrimOverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Inject a positioned floating element into the scrim area. The classic use
 * case is a "monitoring" UX where the rest of the page is dimmed but a small
 * cluster of badges / quick-action buttons stays clickable above the sheet
 * (the wrapper opts back into `pointer-events: auto` even when the scrim
 * itself has `pointer-events: none`).
 */
export type ScrimOverlayOptions = {
  /** Element or fragment to inject as scrim children. */
  children: HTMLElement | DocumentFragment;
  /** Where in the scrim area to place. Default: "top-right". */
  position?: ScrimOverlayPosition;
  /**
   * Wrapper gets `pointer-events: auto` so clicks land on children even when
   * the scrim itself has `pointer-events: none`. Default: true.
   */
  interactive?: boolean;
  /** Padding from the scrim edge in CSS length. Default: "16px". */
  inset?: string;
};

export type SheetEventMap = {
  /**
   * Fires before a snap transition starts (programmatic or gesture-driven).
   * Listeners may invoke `cancel()` synchronously to abort the transition —
   * useful for gating closes (e.g. "form is dirty, ask first"). The check
   * runs synchronously during emit; async cancellation is not supported.
   */
  "before-snap": {
    id: string;
    size: number;
    cancel: () => void;
    previousId: string;
  };
  /** Fires when active snap changes (after animation settles). */
  snap: { id: string; size: number };
  /**
   * Fires continuously during drag/animation: 0..1 within the allowed range.
   *
   * **Payload identity is reused across frames.** The engine mutates a single
   * `{value, size}` object instead of allocating a fresh one per `applySize`
   * (60-120Hz). Mirrors browser `PointerEvent` semantics — consumers must NOT
   * retain a reference (e.g. push to an array) without cloning, or every
   * stored entry will reflect the latest frame's values. Read fields
   * synchronously inside the handler, or copy with `{...payload}` /
   * `payload.value`/`payload.size` capture before any async hand-off.
   */
  progress: { value: number; size: number };
  /** Fires on user-initiated drag start. */
  dragstart: { size: number };
  /**
   * Fires on each pointer move during drag.
   *
   * **Payload identity is reused across frames.** The engine mutates a single
   * `{size, delta}` object instead of allocating a fresh one per `onMove`
   * (60-120Hz). Mirrors browser `PointerEvent` semantics — consumers must NOT
   * retain a reference (e.g. push to an array) without cloning, or every
   * stored entry will reflect the latest frame's values. Read fields
   * synchronously inside the handler, or copy with `{...payload}` /
   * `payload.size`/`payload.delta` capture before any async hand-off.
   */
  drag: { size: number; delta: number };
  /** Fires when drag ends, before snap settles. */
  dragend: { size: number; velocity: number };
  /** Fires when sheet becomes fully closed (size === 0 / "closed" snap). */
  close: void;
  /** Fires when sheet opens from a closed state. */
  open: { id: string };
};

export type EngineOptions = {
  // ─── DOM refs ─────────────────────────────────────────────────────────
  /** Element that becomes the sheet container. */
  element: HTMLElement;
  /** Element used as the drag handle (defaults to `element`). */
  handle?: HTMLElement;
  /** Element whose scroll position gates pull-to-close swipes. */
  scrollContainer?: HTMLElement;
  /** Optional backdrop element — opacity is bound to progress. */
  backdrop?: HTMLElement;
  /** Optional element that fades in behind the sheet driven by progress. */
  screenComponent?: HTMLElement;

  // ─── Geometry ─────────────────────────────────────────────────────────
  /** Direction the sheet expands from. Default: "bottom". */
  mode?: SheetMode;
  /** Ordered list of snap points, smallest → largest. */
  snapPoints: SnapPointDef[];
  /** Subset of snap-point ids the sheet may settle on right now. */
  allowed?: string[];
  /** Initial snap id. Falls back to first allowed (or first overall). */
  initial?: string;

  // ─── Animation ────────────────────────────────────────────────────────
  /** Animation duration in ms. Default: 220. */
  duration?: number;
  /** Easing function (t in 0..1 → 0..1). Default: critical-damped spring-ish. */
  easing?: (t: number) => number;
  /** Honour prefers-reduced-motion. Default: true. */
  respectReducedMotion?: boolean;

  // ─── Gesture tuning ───────────────────────────────────────────────────
  /** Velocity threshold (px/ms) above which a flick promotes to next snap. */
  flickVelocity?: number;
  /** Distance threshold (px) below which a drag snaps back to origin. */
  dragThreshold?: number;
  /** Allow dragging beyond max with rubber-banding. Default: true. */
  rubberBand?: boolean;
  /**
   * [start, end] progress range (0..1) over which the backdrop fades from 0
   * to 1. Default [0, 1]. Set [0.3, 1] for a "peek" state where the backdrop
   * stays invisible until the sheet expands past the peek.
   */
  backdropRange?: [number, number];
  /**
   * [start, end] progress range (0..1) over which the screen overlay fades
   * from 0 to 1. Mirror of `backdropRange` for `screenComponent`.
   * Default [0, 1].
   */
  screenRange?: [number, number];
  /**
   * Positioning of `screenComponent`:
   * - `"full"` (default): consumer controls layout — no inline positioning
   *   is applied. Engine only writes opacity and display.
   * - `"above-sheet"`: engine pins the screen overlay to the area NOT
   *   occupied by the sheet (above for `mode:"bottom"`, below for `"top"`,
   *   etc.) using `position: fixed` + `inset` driven by `--bs-size`. Use
   *   this for monitoring-style "dim everything except the active panel"
   *   UX where the sheet stays interactive but the rest of the page dims
   *   without being clickable.
   * - `"off"`: engine forces the scrim invisible (opacity 0 + display none)
   *   and clears its inline `position` / `inset` / `pointer-events` writes.
   *   Use this when a parent toggle hides the scrim without re-mounting.
   *   Switchable at runtime via `setScrimMode`.
   */
  scrimMode?: "full" | "above-sheet" | "off";
  /**
   * Quick-win background color for `screenComponent`, written once at
   * construction. Skipped entirely when absent so consumers who style the
   * scrim via CSS pay no inline-style cost. Any valid CSS `background`
   * value (e.g. `"rgba(0,0,0,0.6)"`, `"#000a"`).
   *
   * **Security**: this string is written to inline `style.background`. The
   * value is NOT escaped — pass only trusted CSS, never user input. Any
   * `url(...)` token inside the value will trigger a network request from
   * the page (potential referer/IP leak via attribute selectors). Reject
   * or sanitise consumer input upstream.
   */
  scrimColor?: string;
  /**
   * Backdrop blur for `screenComponent`. Engine wraps the supplied length in
   * `blur(...)` and writes both `backdropFilter` and the WebKit-prefixed
   * variant once at construction. Pass a CSS length like `"8px"`. Skipped
   * entirely when absent.
   *
   * **Security**: same caveat as `scrimColor` — value is written to inline
   * `style.backdropFilter` without sanitisation. Pass trusted CSS only.
   */
  scrimBlur?: string;
  /**
   * Whether the scrim accepts pointer events. Default `false` — engine
   * writes `pointer-events: none` so clicks/taps pass through to underlying
   * UI (matches `scrimMode: "above-sheet"`'s existing behaviour). Set
   * `true` when the scrim itself must be interactive (e.g. consumer wires
   * its own click handler). Applied once at construction.
   */
  scrimInteractive?: boolean;
  /**
   * Click on the scrim snaps to the first non-zero allowed snap (same target
   * as `autoCollapseAfter`). Default `false`. When enabled together with
   * `scrimInteractive: false`, engine auto-promotes pointer-events to `auto`
   * — otherwise the listener would never fire. Listener installs in
   * `attach()` and tears down in `destroy()`.
   */
  scrimTapToClose?: boolean;
  /**
   * Curated scrim look-and-feel preset — applied at construction BEFORE the
   * individual `scrimColor` / `scrimBlur` / `screenRange` / `scrimInteractive`
   * options, so a preset gives baseline values and any explicit option still
   * wins. Use this to opt into a named visual style without remembering each
   * underlying field. See `SCRIM_PRESETS` for the exact values per preset.
   */
  scrimPreset?: ScrimPreset;

  // ─── Animation presets ────────────────────────────────────────────────
  /**
   * Animation strategy / preset. The two **base kinds** are physics-driven
   * `"spring"` (default — carries drag velocity into the settle, feels
   * native) and time-driven `"tween"` (fixed-duration easing curve). Four
   * named **presets** layer on top, each prefilling `spring` / `duration`
   * / `easing` with a curated config — consumer-supplied `spring`,
   * `duration`, or `easing` still override the preset's defaults.
   *
   * Subjective feel:
   *   - `"spring"` — default critical-damped spring. Native feel.
   *   - `"tween"` — fixed-duration ease-out. Predictable timing.
   *   - `"ios-spring"` — quick + slightly underdamped, like iOS modals
   *     (`{ stiffness: 300, damping: 30, mass: 1 }`). Best for iOS-native
   *     apps where users expect Apple's exact bounce signature.
   *   - `"material-bounce"` — slower, more bounce, Material You feel
   *     (`{ stiffness: 200, damping: 22, mass: 1 }`). Best for Android-
   *     native apps and playful, brand-led UIs.
   *   - `"linear"` — `tween` with `easeLinear` (no acceleration). Use when
   *     the consumer wants explicit reduced-motion-friendly behaviour
   *     without trading off the deterministic timing of a tween.
   *   - `"snappy"` — fast tween (`duration: 180`, `easeOutQuint`). Best
   *     for UI-heavy / dense apps that want IMMEDIATE response — file
   *     pickers, chat composers, command palettes.
   */
  animation?:
    | "spring"
    | "tween"
    | "ios-spring"
    | "material-bounce"
    | "linear"
    | "snappy";
  /** Spring config when `animation: "spring"`. Defaults: critical damping. */
  spring?: { stiffness?: number; damping?: number; mass?: number };

  // ─── Accessibility ────────────────────────────────────────────────────
  /**
   * Trap Tab focus inside the sheet when expanded. Default: false. When
   * true, focus is moved into the sheet on open (or to `initialFocus`),
   * Tab cycles within, and original focus is restored on close.
   */
  focusTrap?: boolean;
  /** Selector or HTMLElement to focus when the sheet opens (focusTrap only). */
  initialFocus?: string | HTMLElement;
  /** Listen for Escape key and close the sheet. Default: true. */
  closeOnEscape?: boolean;
  /** Lock body scroll when the sheet is non-closed. Default: true. */
  lockBodyScroll?: boolean;

  // ─── History integration ──────────────────────────────────────────────
  /**
   * Intercept the Android hardware back button (and browser back) — close the
   * sheet instead of navigating away. Pushes a no-op history entry on open.
   * Default: false (opt-in to avoid surprising consumers with their own
   * routing logic).
   */
  closeOnBack?: boolean;
  /**
   * Sync the sheet's open/close state with the URL. When set, opening the
   * sheet pushes `routedTo` onto `history` (`history.pushState({__bsRouted:
   * routedTo}, "", routedTo)`); closing the sheet calls `history.back()` if
   * the current entry was the one we pushed. Browser back (`popstate`) on
   * the routed entry programmatically calls `engine.close()`.
   *
   * Coexists with `closeOnBack` — if both are set, `routedTo` wins (the
   * structured version of the same idea). Skipped on SSR (no `window`).
   *
   * **Security:** the value is forwarded directly to `history.pushState` and
   * the URL bar reflects it. Do NOT pass user-controlled input here (e.g.
   * `searchParams.get('next')`) without a same-origin allowlist — although
   * `pushState` itself does not navigate to `javascript:` URLs, downstream
   * code that reads `location.href` (e.g. a "share this URL" button) would
   * become an XSS sink at the consumer site. Cross-origin URLs throw
   * `SecurityError`, which is silently caught.
   *
   * Default: undefined (off).
   */
  routedTo?: string;
  /**
   * Mark the sheet's siblings as `inert` while open — full-modal a11y. AT
   * and pointer events skip the rest of the page. Default: false. Enable
   * only when the sheet must hijack the entire surface (e.g. confirmation
   * dialog); leave false when the sheet is meant to coexist with chrome
   * outside it (search bar, tab controls, etc.).
   */
  inertSiblings?: boolean;

  // ─── Lifecycle / persistence ──────────────────────────────────────────
  /**
   * Persist active snap id to `localStorage[persistKey]` so the sheet returns
   * to its last state after a page reload. Skipped on SSR / private-browsing
   * / disabled-storage. The engine never deletes the entry — that's the
   * consumer's lifecycle decision (e.g. on logout).
   */
  persistKey?: string;
  /**
   * Auto-collapse to the first non-zero allowed snap (typically `minimized`)
   * after this many milliseconds of no drag/snap activity. Suppressed mid-
   * drag (finger still down) and when already at the target snap. Pass
   * `undefined` to disable.
   */
  autoCollapseAfter?: number;
  /**
   * Sister sheets that should shrink to their first non-zero allowed snap
   * when THIS sheet opens (closed → open transition). Use case: navigation
   * rail expands → bottom panel auto-minimizes. Set later via
   * `setLinkedSheets` if peers don't exist at construction time.
   *
   * The reaction is one-directional and fires only on the `open` event —
   * the linked sheet's resulting `snap` does not feed back into THIS sheet
   * because `open` is gated to closed→open transitions. Wiring sheets in a
   * cycle (A links B, B links A) is supported by this gate but only safe
   * as long as neither sheet is constructed already-open.
   */
  linkedSheets?: BottomSheetEngineLike[];

  // ─── Experimental ─────────────────────────────────────────────────────
  /**
   * @experimental
   *
   * Wrap **programmatic** `snapTo()` calls in `document.startViewTransition`
   * so Chrome/Safari can run a smooth shared-element morph between snap
   * states. Default: `false`.
   *
   * Important constraints:
   *   - **Programmatic snaps only.** Gesture-driven settles (drag → flick)
   *     are NOT wrapped — view transitions are designed for discrete
   *     state changes and would conflict with a 60fps spring update loop.
   *   - **Final settle only.** The engine wraps the single discrete
   *     "apply target size" call, not each frame of `animateTo`. When
   *     view transitions are enabled, the spring/tween between frames
   *     is bypassed and the browser drives the cross-fade instead.
   *   - **No-op without browser support.** Falls back to the normal
   *     animation path on browsers that don't ship `startViewTransition`
   *     (Firefox at the time of writing) — opt-in is safe.
   *
   * Treat this as a **bleeding-edge** opt-in: visually verify on each
   * supported browser before relying on it in production.
   */
  viewTransitions?: boolean;
};

// Type-only forward import — no runtime cycle, only the structural shape
// flows back into types.ts. Plugins/linked sheets get full engine typing
// without a hard module dependency at runtime.
import type { BottomSheetEngine } from "./BottomSheetEngine";

/**
 * Alias surfaced for `linkedSheets` and `Plugin.install`. Keeping this
 * separate from the class lets adapters fake the engine in tests and lets
 * future internal-only methods stay private without breaking plugin typing.
 */
export type BottomSheetEngineLike = BottomSheetEngine;

/**
 * Transactional teardown scope passed to `Plugin.install` as the second
 * argument. A plugin that registers DOM listeners / timers BEFORE doing
 * something that might throw should push their cleanup callbacks into the
 * scope — engine drains the scope on install failure so partial side effects
 * don't leak. On successful install the scope is merged into the engine's
 * destroy-time TeardownStack, so plugins that ONLY use scope.add (and don't
 * return a teardown function) still get correct destroy() cleanup.
 *
 * Optional — plugins that don't accept the second argument keep working
 * unchanged. Use when install does multi-step setup that can fail mid-way.
 *
 * @example
 * ```ts
 * const myPlugin: Plugin = {
 *   name: "analytics",
 *   install: (engine, scope) => {
 *     // Step 1 — listener that must be cleaned up if step 2 throws.
 *     const off = engine.on("snap", payload => track("snap", payload));
 *     scope.add(off);
 *
 *     // Step 2 — risky work that might throw (network probe, feature
 *     // detection, etc.). If it throws, engine drains `scope` and unsubs
 *     // the listener registered above.
 *     const observer = new ResizeObserver(() => {});
 *     observer.observe(document.body);
 *     scope.add(() => observer.disconnect());
 *
 *     // Optional: return ONE additional cleanup. Both `scope.add` callbacks
 *     // AND this returned teardown run on `engine.destroy()` (LIFO).
 *     return () => track("plugin-destroyed");
 *   },
 * };
 * ```
 */
export type TeardownScope = {
  /**
   * Register a cleanup callback. Non-functions (`null`/`undefined`/strings/
   * numbers/objects) are silently rejected — useful when a plugin's helper
   * returns `void | (() => void)` and you want to forward the result without
   * a runtime check.
   */
  add: (fn: (() => void) | null | undefined) => void;
};

/**
 * A plugin extends the engine via `engine.use(plugin)`. `install` runs once
 * at registration; the optional teardown function (returned from install)
 * is captured by the engine and invoked on `destroy()`. Plugins are free
 * to subscribe to events, monkey-patch methods, or hold their own state.
 *
 * **Transactional contract**: `install` should be transactional — if it
 * throws midway, any DOM listeners / timers / external state it set up
 * BEFORE the throw will leak (engine can't introspect arbitrary side
 * effects). Use the optional `scope` parameter to push partial cleanup
 * callbacks; the engine will drain `scope` if `install` throws, and merge
 * it into destroy-time teardowns on success.
 */
export type Plugin = {
  /** Human-readable identifier — surfaced in warnings and debug logs. */
  name: string;
  /**
   * Called once at `engine.use(plugin)` time. Return a function to run
   * during `destroy()` for cleanup (timers, listeners, observers).
   *
   * The optional `scope` argument lets the plugin register partial cleanups
   * before each side effect — engine rolls them back on install failure.
   */
  install: (
    engine: BottomSheetEngine,
    scope: TeardownScope,
  ) => void | (() => void);
};

export type EngineState = {
  size: number;
  activeId: string;
  isDragging: boolean;
  isAnimating: boolean;
  progress: number;
};
