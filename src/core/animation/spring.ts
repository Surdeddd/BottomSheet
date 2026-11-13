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
  maxDuration?: number;
  onUpdate: (value: number, velocity: number) => void;
};

export type SpringHandle = {
  cancel: () => void;
  retarget: (to: number) => void;
  promise: Promise<void>;
};

const MAX_DT = 1 / 30;
const MAX_DURATION_MS = 3000;

export const runSpring = ({
  from,
  to,
  velocity = 0,
  config,
  maxDuration = MAX_DURATION_MS,
  onUpdate,
}: SpringRunOptions): SpringHandle => {
  const cfg = { ...DEFAULT_SPRING, ...config };
  let cancelled = false;
  let finished = false;
  let rafId = 0;
  let resolveFn: (() => void) | null = null;

  let x = from;
  let v = velocity;
  let target = to;
  let lastTime = performance.now();
  let deadline = lastTime + maxDuration;

  const promise = new Promise<void>(resolve => {
    resolveFn = resolve;
    const land = (): void => {
      finished = true;
      onUpdate(target, 0);
      resolve();
    };
    const step = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(Math.max(0, now - lastTime) / 1000, MAX_DT);
      lastTime = Math.max(lastTime, now);

      const steps = Math.max(1, Math.ceil(dt * 240));
      const subDt = dt / steps;
      let stepsLeft = steps;
      while (stepsLeft-- > 0) {
        const force = -cfg.stiffness * (x - target) - cfg.damping * v;
        const accel = force / cfg.mass;
        v += accel * subDt;
        x += v * subDt;
      }

      if (!Number.isFinite(x) || !Number.isFinite(v) || lastTime >= deadline) {
        land();
        return;
      }
      onUpdate(x, v);

      const isAtRest =
        Math.abs(target - x) < (cfg.restDelta ?? 0.5) &&
        Math.abs(v) < (cfg.restSpeed ?? 0.5);

      if (isAtRest) {
        land();
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
    retarget: next => {
      if (cancelled || finished) return;
      target = next;
      deadline = performance.now() + maxDuration;
    },
    promise,
  };
};
