import { tween, type Tween, easeOutBack } from "../animation/animation";
import { runSpring, type SpringHandle } from "../animation/spring";
import { resolveAnimationPreset } from "../animation/animation-presets";
import {
  sampleSpringSettle,
  sampleTweenSettle,
  type SettleSamples,
} from "../animation/waapi-settle";
import type { EngineOptions } from "../types";

const DEFAULT_DURATION = 220;
const VELOCITY_PX_PER_S = 1000;

export type AnimationRunnerDeps = {
  element: HTMLElement;
  getRootEl: () => HTMLElement | null;
  applySize: (size: number) => void;
  getSize: () => number;
  isDragging: () => boolean;
  applyAux?: (size: number) => void;
  getTransformFor?: (size: number) => string;
};

export type AnimationRunnerOptions = {
  animation?: EngineOptions["animation"];
  settleAnimation?: "waapi";
  duration?: number;
  easing?: (t: number) => number;
  spring?: { stiffness?: number; damping?: number; mass?: number };
  respectReducedMotion?: boolean;
  viewTransitions?: boolean;
};

type WaapiEntry = {
  anim: Animation;
  stop: () => void;
};

export class AnimationRunner {
  private element: HTMLElement;
  private getRootEl: () => HTMLElement | null;
  private applySizeFn: (size: number) => void;
  private getSize: () => number;
  private isDragging: () => boolean;
  private applyAux?: (size: number) => void;
  private getTransformFor?: (size: number) => string;
  private settleWaapi: boolean;
  private currentWaapi: WaapiEntry | null = null;

  private animationKind: "spring" | "tween";
  private springConfig: { stiffness?: number; damping?: number; mass?: number };
  private duration: number;
  private easing: (t: number) => number;
  private respectReducedMotion: boolean;
  private reducedMotion = false;
  private detachReducedMotion: (() => void) | null = null;
  readonly viewTransitionsAvailable: boolean;

  currentTween: Tween | null = null;
  currentSpring: SpringHandle | null = null;

  constructor(deps: AnimationRunnerDeps, opts: AnimationRunnerOptions) {
    this.element = deps.element;
    this.getRootEl = deps.getRootEl;
    this.applySizeFn = deps.applySize;
    this.getSize = deps.getSize;
    this.isDragging = deps.isDragging;
    this.applyAux = deps.applyAux;
    this.getTransformFor = deps.getTransformFor;
    this.settleWaapi = opts.settleAnimation === "waapi";

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

  get isAnimating(): boolean {
    return (
      this.currentTween !== null ||
      this.currentSpring !== null ||
      this.currentWaapi !== null
    );
  }

  cancel(): void {
    this.currentTween?.cancel();
    this.currentSpring?.cancel();
    if (this.currentWaapi) {
      const entry = this.currentWaapi;
      this.currentWaapi = null;
      entry.stop();
      try {
        entry.anim.cancel();
      } catch {
      }
    }
  }

  async animateTo(target: number, velocityPxPerMs: number): Promise<void> {
    if (target === this.getSize()) {
      if (!this.isAnimating && !this.isDragging()) {
        this.element.style.willChange = "";
      }
      return;
    }
    this.currentTween?.cancel();
    this.currentSpring?.cancel();
    this.getRootEl()?.setAttribute("data-animating", "true");
    this.element.style.willChange = "transform";

    if (this.reducedMotion) {
      this.applySizeFn(target);
      this.getRootEl()?.removeAttribute("data-animating");
      if (!this.isDragging()) this.element.style.willChange = "";
      return;
    }

    if (
      this.settleWaapi &&
      this.applyAux &&
      this.getTransformFor &&
      typeof this.element.animate === "function"
    ) {
      const samples =
        this.animationKind === "spring"
          ? sampleSpringSettle(
              this.getSize(),
              target,
              velocityPxPerMs * VELOCITY_PX_PER_S,
              this.springConfig,
            )
          : sampleTweenSettle(
              this.getSize(),
              target,
              this.duration,
              this.easing,
            );
      if (samples.values.length >= 2 && samples.durationMs > 0) {
        await this.runWaapiSettle(samples, target);
        if (!this.isAnimating) {
          this.getRootEl()?.removeAttribute("data-animating");
          if (!this.isDragging()) this.element.style.willChange = "";
        }
        return;
      }
    }

    if (this.animationKind === "spring") {
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
    if (!this.isAnimating) {
      this.getRootEl()?.removeAttribute("data-animating");
      if (!this.isDragging()) this.element.style.willChange = "";
    }
  }

  private async runWaapiSettle(
    samples: SettleSamples,
    target: number,
  ): Promise<void> {
    const applyAux = this.applyAux!;
    const getTransformFor = this.getTransformFor!;
    const frames = samples.values.map(v => ({
      transform: getTransformFor(v),
    }));
    const anim = this.element.animate(frames, {
      duration: samples.durationMs,
      easing: "linear",
      fill: "forwards",
    });

    let stopped = false;
    let auxRaf = 0;
    const start = performance.now();
    const lastIdx = samples.values.length - 1;
    const auxTick = (): void => {
      if (stopped) return;
      const elapsed = performance.now() - start;
      const idx = Math.min(Math.floor(elapsed / samples.stepMs), lastIdx);
      applyAux(samples.values[idx]!);
      auxRaf = requestAnimationFrame(auxTick);
    };
    auxRaf = requestAnimationFrame(auxTick);

    const entry: WaapiEntry = {
      anim,
      stop: () => {
        stopped = true;
        cancelAnimationFrame(auxRaf);
      },
    };
    this.currentWaapi = entry;

    try {
      await anim.finished;
    } catch {
    }
    entry.stop();
    const wasCurrent = this.currentWaapi === entry;
    if (wasCurrent) this.currentWaapi = null;

    if (wasCurrent && anim.playState === "finished") {
      this.applySizeFn(target);
      try {
        anim.cancel();
      } catch {
      }
    }
  }

  destroy(): void {
    this.detachReducedMotion?.();
    this.detachReducedMotion = null;
    this.currentTween = null;
    this.currentSpring = null;
    if (this.currentWaapi) {
      const entry = this.currentWaapi;
      this.currentWaapi = null;
      entry.stop();
      try {
        entry.anim.cancel();
      } catch {
      }
    }
  }
}
