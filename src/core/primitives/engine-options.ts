import type { EngineOptions, SheetMode } from "../types";
import type { ScrimControllerOptions } from "../controllers/scrim-controller";
import type { AnimationRunnerOptions } from "../controllers/animation-runner";
import type { LifecycleControllerOptions } from "../controllers/lifecycle-controller";
import { readPersistedId } from "../features/persist";

/**
 * Defaults for the engine's per-frame physics constants. Tuned via Playwright
 * traces on iOS Safari + Android Chrome reference devices; changing these
 * shifts the perceived "snap weight" and is a v2 concern.
 */
export const DEFAULT_FLICK_VELOCITY = 0.65;
export const DEFAULT_DRAG_THRESHOLD = 18;
export const DEFAULT_DURATION = 220;

/**
 * Fully-resolved engine options — every `??` default has been collapsed to a
 * concrete value, every fallback chain (`initial` → `allowed[0]` → `snapPoints[0].id`
 * → `"default"`) has been walked, every cross-option auto-promotion (e.g.
 * `scrimInteractive` auto-true when `scrimTapToClose` is set) has been applied.
 *
 * Engine constructor reads from this shape after calling `resolveEngineOptions`,
 * which lets the resolution be unit-tested in isolation (no DOM, no controllers,
 * pure data → data) and keeps the constructor focused on side-effectful wiring.
 */
export type ResolvedEngineOptions = {
  /** Axis the sheet animates along. */
  mode: SheetMode;
  /** Pixels-per-ms threshold beyond which a drag commits as a flick. */
  flickVelocity: number;
  /** Pixels of drag distance required before the sheet starts following. */
  dragThreshold: number;
  /** Whether dragging past the allowed range produces rubber-band slack. */
  rubberBandEnabled: boolean;
  /** Whether browser back-button closes the sheet (history.pushState integration). */
  closeOnBack: boolean;

  /**
   * The runtime allow-list — defaults to every snap-point's id when caller
   * omitted `allowed`. Engine forwards this to SnapResolver.
   */
  initialAllowed: string[];
  /**
   * Initial active snap id — resolved through the priority chain:
   *   1. `opts.initial` if set
   *   2. `initialAllowed[0]`
   *   3. `opts.snapPoints[0]?.id`
   *   4. `"default"` (degenerate fallback for empty snapPoints)
   * Then, if `persistKey` is set AND localStorage holds a previously-saved id
   * AND that id is in `initialAllowed`, the persisted value overrides.
   */
  initialId: string;

  /** Pre-shaped options bag for the ScrimController constructor. */
  scrim: ScrimControllerOptions;
  /** Pre-shaped options bag for the AnimationRunner constructor. */
  animation: AnimationRunnerOptions;
  /**
   * Pre-shaped options bag for the LifecycleController constructor —
   * fully assembled when the caller passes the optional `extras` argument
   * (engine does so to fold in the body-descendant `shouldApplyInertSiblings`
   * closure that captures `this.element`). Without `extras`, the field is
   * omitted and the controller uses its own default predicate.
   */
  lifecycle: LifecycleControllerOptions;
};

/**
 * Engine-supplied closures that can't live in the pure resolution layer
 * because they capture `this`-bound references. Passed as the optional
 * second argument to `resolveEngineOptions` so the lifecycle bag is fully
 * assembled at the call site (engine constructor passes the
 * body-descendant guard that reads `this.element`).
 */
export type EngineOptionsExtras = {
  /**
   * Closure that decides whether to apply `inert` to body siblings. Engine
   * passes a body-descendant check that reads `this.element` so portal'd /
   * shadow-DOM mounts don't accidentally mark unrelated siblings inert.
   */
  shouldApplyInertSiblings?: () => boolean;
};

/**
 * Pure resolution of engine options. NO side effects beyond the localStorage
 * read for `persistKey` (which is deterministic per environment).
 *
 * Extracting this from the constructor body has three concrete payoffs:
 *   1. **Testability** — the resolution is a function from `EngineOptions` to
 *      `ResolvedEngineOptions`, snapshot-testable without spinning up a DOM.
 *   2. **Readability** — the constructor's ~80 lines of `??` chains collapse
 *      to one call + concrete-typed reads, leaving only side-effectful wiring
 *      (controller construction, attach()) inline.
 *   3. **Cross-option correctness** — auto-promotions like `scrimInteractive`
 *      ↔ `scrimTapToClose` live in one place, so adding new ones doesn't
 *      require hunting through multiple constructor lines.
 */
export function resolveEngineOptions(
  opts: EngineOptions,
  extras?: EngineOptionsExtras,
): ResolvedEngineOptions {
  const initialAllowed = opts.allowed ?? opts.snapPoints.map(p => p.id);

  // Initial id chain — degenerate "default" fallback only fires when
  // `snapPoints` is empty AND no override given. Engine still functions in
  // that state but won't have a renderable snap.
  let initialId =
    opts.initial ??
    initialAllowed[0] ??
    opts.snapPoints[0]?.id ??
    "default";
  if (opts.persistKey) {
    const restored = readPersistedId(opts.persistKey);
    if (restored && initialAllowed.includes(restored)) {
      initialId = restored;
    }
  }

  return {
    mode: opts.mode ?? "bottom",
    flickVelocity: opts.flickVelocity ?? DEFAULT_FLICK_VELOCITY,
    dragThreshold: opts.dragThreshold ?? DEFAULT_DRAG_THRESHOLD,
    rubberBandEnabled: opts.rubberBand ?? true,
    closeOnBack: opts.closeOnBack ?? false,
    initialAllowed,
    initialId,
    scrim: {
      scrimMode: opts.scrimMode,
      scrimColor: opts.scrimColor,
      scrimBlur: opts.scrimBlur,
      // Auto-promote pointer-events when tap-to-close is on so the click
      // listener actually receives events. Caller can still force `false`
      // explicitly to opt out — `??` only kicks in for `undefined`.
      scrimInteractive:
        opts.scrimInteractive ??
        (opts.scrimTapToClose ? true : undefined),
      scrimTapToClose: opts.scrimTapToClose,
      scrimPreset: opts.scrimPreset,
      screenRange: opts.screenRange,
      backdropRange: opts.backdropRange,
    },
    animation: {
      animation: opts.animation,
      duration: opts.duration,
      easing: opts.easing,
      spring: opts.spring,
      respectReducedMotion: opts.respectReducedMotion,
      viewTransitions: opts.viewTransitions,
    },
    lifecycle: {
      focusTrap: opts.focusTrap,
      initialFocus: opts.initialFocus,
      closeOnEscape: opts.closeOnEscape,
      lockBodyScroll: opts.lockBodyScroll,
      inertSiblings: opts.inertSiblings,
      // Folded in from `extras` so the lifecycle bag is fully assembled at
      // the call site — engine no longer needs a spread+override at
      // controller construction. When `extras` is omitted, the field stays
      // undefined and the controller uses its own default predicate.
      shouldApplyInertSiblings: extras?.shouldApplyInertSiblings,
    },
  };
}
