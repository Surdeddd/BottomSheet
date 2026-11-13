export const easeOutBack = (t: number): number => {
  const c1 = 1.40158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeLinear = (t: number): number => t;

export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);

const MIN_RETARGET_MS = 120;

export type Tween = {
  cancel: () => void;
  retarget: (to: number) => void;
  promise: Promise<void>;
};

export type TweenOptions = {
  from: number;
  to: number;
  duration: number;
  easing?: (t: number) => number;
  onUpdate: (value: number) => void;
};

export const tween = ({
  from,
  to,
  duration,
  easing = easeOutCubic,
  onUpdate,
}: TweenOptions): Tween => {
  let cancelled = false;
  let finished = false;
  let rafId = 0;
  let resolveFn: (() => void) | null = null;
  let start = performance.now();
  let origin = from;
  let target = to;
  let span = duration;
  let last = from;

  const promise = new Promise<void>(resolve => {
    resolveFn = resolve;
    if (duration <= 0) {
      finished = true;
      onUpdate(to);
      resolve();
      return;
    }
    const step = (now: number) => {
      if (cancelled) return;
      const elapsed = Math.max(0, now - start);
      const t = Math.min(elapsed / span, 1);
      last = origin + (target - origin) * easing(t);
      onUpdate(last);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        finished = true;
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
    retarget: next => {
      if (cancelled || finished || next === target) return;
      const now = performance.now();
      const remaining = span - Math.max(0, now - start);
      origin = last;
      target = next;
      start = now;
      span = Math.max(remaining, MIN_RETARGET_MS);
    },
    promise,
  };
};

export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
