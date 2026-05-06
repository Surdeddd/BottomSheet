/**
 * Damped harmonic oscillator: x'' = -k(x - target)/m - c*x'/m
 * Integrated with semi-implicit Euler at variable dt; settles when both
 * displacement and velocity drop below epsilon.
 */
export type SpringConfig = {
  stiffness: number;
  damping: number;
  mass: number;
  /** Stop animation when |x - target| < restDelta AND |v| < restSpeed. */
  restDelta?: number;
  restSpeed?: number;
};

export const DEFAULT_SPRING: SpringConfig = {
  stiffness: 220,
  damping: 26,
  mass: 1,
  restDelta: 0.5,
  restSpeed: 0.5,
};

export type SpringRunOptions = {
  from: number;
  to: number;
  velocity?: number;
  config?: Partial<SpringConfig>;
  onUpdate: (value: number, velocity: number) => void;
};

export type SpringHandle = {
  cancel: () => void;
  promise: Promise<void>;
};

// clamp dt during background tabs to avoid blow-ups
const MAX_DT = 1 / 30;

/**
 * Run a spring animation from `from` to `to` with initial velocity. The
 * promise resolves on natural settle AND on cancel so awaiters always
 * settle; callers cycle-nonce-check after the await before running
 * post-settle effects.
 */
export const runSpring = ({
  from,
  to,
  velocity = 0,
  config,
  onUpdate,
}: SpringRunOptions): SpringHandle => {
  const cfg = { ...DEFAULT_SPRING, ...config };
  let cancelled = false;
  let rafId = 0;
  let resolveFn: (() => void) | null = null;

  let x = from;
  let v = velocity;
  let lastTime = performance.now();

  const promise = new Promise<void>(resolve => {
    resolveFn = resolve;
    const step = (now: number) => {
      if (cancelled) return;
      const dt = Math.min((now - lastTime) / 1000, MAX_DT);
      lastTime = now;

      // Sub-step integration for stability with stiff springs. Physics runs
      // multiple times per RAF but writes the DOM exactly once per frame.
      const subDt = Math.min(dt, 1 / 240);
      let stepsLeft = Math.max(1, Math.ceil(dt / subDt));
      while (stepsLeft-- > 0) {
        const force = -cfg.stiffness * (x - to) - cfg.damping * v;
        const accel = force / cfg.mass;
        v += accel * subDt;
        x += v * subDt;
      }
      onUpdate(x, v);

      const isAtRest =
        Math.abs(to - x) < (cfg.restDelta ?? 0.5) &&
        Math.abs(v) < (cfg.restSpeed ?? 0.5);

      if (isAtRest) {
        onUpdate(to, 0);
        resolve();
      } else {
        rafId = requestAnimationFrame(step);
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
