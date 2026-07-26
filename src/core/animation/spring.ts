export type SpringConfig = {
  stiffness: number;
  damping: number;
  mass: number;
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

const MAX_DT = 1 / 30;

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

      const steps = Math.max(1, Math.ceil(dt * 240));
      const subDt = dt / steps;
      let stepsLeft = steps;
      while (stepsLeft-- > 0) {
        const force = -cfg.stiffness * (x - to) - cfg.damping * v;
        const accel = force / cfg.mass;
        v += accel * subDt;
        x += v * subDt;
      }

      if (!Number.isFinite(x) || !Number.isFinite(v)) {
        onUpdate(to, 0);
        resolve();
        return;
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
