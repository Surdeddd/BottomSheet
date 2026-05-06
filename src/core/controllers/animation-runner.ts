import { tween, type Tween, easeOutBack } from "../animation/animation";
import { runSpring, type SpringHandle } from "../animation/spring";
import { resolveAnimationPreset } from "../animation/animation-presets";
import type { EngineOptions } from "../types";

const DEFAULT_DURATION = 220;
const VELOCITY_PX_PER_S = 1000;

/**
 * Engine callbacks the runner consults each frame + at start/end. Passed
 * once at construction; runner never reads engine state directly so the
 * boundary stays clean.
 */
export type AnimationRunnerDeps = {
  /** Sheet element — runner toggles `willChange: 'transform'` here. */
  element: HTMLElement;
  /** Root attribute target — runner sets `data-animating="true"` while running. */
  getRootEl: () => HTMLElement | null;
  /** Per-frame size writer (engine.applySize). Called from spring/tween onUpdate. */
  applySize: (size: number) => void;
  /** Live size getter — runner reads engine.size for early-return same-target check. */
  getSize: () => number;
  /** Drag flag — gate the post-settle willChange clear (drag still wants the hint). */
  isDragging: () => boolean;
};

export type AnimationRunnerOptions = {
  animation?: EngineOptions["animation"];
  duration?: number;
  easing?: (t: number) => number;
  spring?: { stiffness?: number; damping?: number; mass?: number };
  respectReducedMotion?: boolean;
  viewTransitions?: boolean;
};

/**
 * Owns the snap → settle animation lifecycle. Holds the active spring/tween
 * handles, the resolved animation config (kind, duration, easing, spring),
 * and the live `prefers-reduced-motion` mq listener. Engine consults via
 * `animateTo()` / `cancel()`; the cycle invariant (AbortController) stays on
 * engine — `animateTo` returns a promise that resolves when the animation
 * completes OR when `cancel()` is called externally.
 *
 * @internal
 */
export class AnimationRunner {
  private element: HTMLElement;
  private getRootEl: () => HTMLElement | null;
  private applySizeFn: (size: number) => void;
  private getSize: () => number;
  private isDragging: () => boolean;

  private animationKind: "spring" | "tween";
  private springConfig: { stiffness?: number; damping?: number; mass?: number };
  private duration: number;
  private easing: (t: number) => number;
  private respectReducedMotion: boolean;
  /** Live-tracked via mq listener so animateTo skips matchMedia per snap. */
  private reducedMotion = false;
  /** Disposes the matchMedia change listener — drained from destroy(). */
  private detachReducedMotion: (() => void) | null = null;
  /** Computed once — both inputs (option + API presence) stable for life. */
  readonly viewTransitionsAvailable: boolean;

  /** In-flight handles. Public for tests / debugging only — engine drives via cancel(). */
  currentTween: Tween | null = null;
  currentSpring: SpringHandle | null = null;

  constructor(deps: AnimationRunnerDeps, opts: AnimationRunnerOptions) {
    this.element = deps.element;
    this.getRootEl = deps.getRootEl;
    this.applySizeFn = deps.applySize;
    this.getSize = deps.getSize;
    this.isDragging = deps.isDragging;

    // Layer user values over the preset's defaults so overriding e.g. just
    // `stiffness` on `material-bounce` keeps the preset's damping/mass.
    const preset = resolveAnimationPreset(opts.animation);
    this.animationKind = preset.kind;
    this.duration = opts.duration ?? preset.duration ?? DEFAULT_DURATION;
    this.easing = opts.easing ?? preset.easing ?? easeOutBack;
    this.springConfig = { ...(preset.spring ?? {}), ...(opts.spring ?? {}) };
    this.respectReducedMotion = opts.respectReducedMotion ?? true;

    const viewTransitionsEnabled = opts.viewTransitions ?? false;
    this.viewTransitionsAvailable =
      viewTransitionsEnabled &&
      typeof document !== "undefined" &&
      typeof (document as unknown as { startViewTransition?: unknown })
        .startViewTransition === "function";

    if (
      this.respectReducedMotion &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
    ) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = mq.matches;
      const onMqChange = (e: MediaQueryListEvent): void => {
        this.reducedMotion = e.matches;
      };
      // Older Safari ships only the deprecated addListener API; prefer modern.
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onMqChange);
        this.detachReducedMotion = () =>
          mq.removeEventListener("change", onMqChange);
      } else if (typeof (mq as MediaQueryList).addListener === "function") {
        (mq as MediaQueryList).addListener(onMqChange);
        this.detachReducedMotion = () =>
          (mq as MediaQueryList).removeListener(onMqChange);
      }
    }
  }

  /**
   * Live derived flag — `true` whenever a spring/tween handle is in flight.
   * Reading the canonical handles (instead of mirroring into a separate
   * boolean) eliminates the reduced-motion early-return latent bug where
   * the flag stayed true forever, and removes the cross-controller
   * setIsAnimating callback.
   */
  get isAnimating(): boolean {
    return this.currentTween !== null || this.currentSpring !== null;
  }

  /** Cancel any in-flight tween/spring without touching engine state. */
  cancel(): void {
    this.currentTween?.cancel();
    this.currentSpring?.cancel();
  }

  /**
   * Animate from current size to `target`. Resolves when the animation
   * completes; resolves early if cancelled mid-flight (caller checks an
   * abort signal post-await for cycle-invariant correctness).
   */
  async animateTo(target: number, velocityPxPerMs: number): Promise<void> {
    if (target === this.getSize()) return;
    this.currentTween?.cancel();
    this.currentSpring?.cancel();
    this.getRootEl()?.setAttribute("data-animating", "true");
    this.element.style.willChange = "transform";

    if (this.reducedMotion) {
      this.applySizeFn(target);
      this.getRootEl()?.removeAttribute("data-animating");
      if (!this.isDragging()) this.element.style.willChange = "auto";
      return;
    }

    if (this.animationKind === "spring") {
      // Capture local handle before await — a concurrent animateTo() that
      // cancels this spring and assigns a new one would otherwise let our
      // post-await null-clear stomp the fresh handle.
      const spring = runSpring({
        from: this.getSize(),
        to: target,
        velocity: velocityPxPerMs * VELOCITY_PX_PER_S,
        config: this.springConfig,
        onUpdate: v => this.applySizeFn(v),
      });
      this.currentSpring = spring;
      await spring.promise;
      if (this.currentSpring === spring) this.currentSpring = null;
    } else {
      const tw = tween({
        from: this.getSize(),
        to: target,
        duration: this.duration,
        easing: this.easing,
        onUpdate: v => this.applySizeFn(v),
      });
      this.currentTween = tw;
      await tw.promise;
      if (this.currentTween === tw) this.currentTween = null;
    }
    // Only the cycle that owns the last in-flight handle should clear the
    // root attribute / willChange — if a newer cycle is still running,
    // its own settle path will handle teardown.
    if (!this.isAnimating) {
      this.getRootEl()?.removeAttribute("data-animating");
      // Drop the compositor-layer hint after settle to free GPU memory.
      // Skip when the user is still dragging — drag itself wants the hint
      // until the gesture ends.
      if (!this.isDragging()) this.element.style.willChange = "auto";
    }
  }

  /** Tear down the matchMedia listener. Engine calls from destroy(). */
  destroy(): void {
    this.detachReducedMotion?.();
    this.detachReducedMotion = null;
    this.currentTween = null;
    this.currentSpring = null;
  }
}
