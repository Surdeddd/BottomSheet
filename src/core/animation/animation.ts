export const easeOutBack = (t: number): number => {
  const c1 = 1.40158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeLinear = (t: number): number => t;

export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);

export type Tween = {
  cancel: () => void;
  promise: Promise<void>;
};

export type TweenOptions = {
  from: number;
  to: number;
  duration: number;
  easing?: (t: number) => number;
  onUpdate: (value: number) => void;
};

/**
 * rAF tween. Promise resolves both on natural completion AND on cancel so
 * callers awaiting it always settle; they're expected to cycle-nonce-check
 * after the await before running post-settle effects.
 */
export const tween = ({
  from,
  to,
  duration,
  easing = easeOutCubic,
  onUpdate,
}: TweenOptions): Tween => {
  let cancelled = false;
  let rafId = 0;
  let resolveFn: (() => void) | null = null;
  const start = performance.now();

  const promise = new Promise<void>(resolve => {
    resolveFn = resolve;
    if (duration <= 0) {
      onUpdate(to);
      resolve();
      return;
    }
    const step = (now: number) => {
      if (cancelled) return;
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const value = from + (to - from) * easing(t);
      onUpdate(value);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    rafId = requestAnimationFrame(step);
  });

  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      resolveFn?.();
    },
    promise,
  };
};

export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
