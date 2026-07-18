import { DEFAULT_SPRING, type SpringConfig } from "./spring";

export type SettleSamples = {
  values: number[];
  stepMs: number;
  durationMs: number;
};

const SIM_HZ = 240;
const SAMPLE_STRIDE = 4;
const MAX_SIM_MS = 3000;

export function sampleSpringSettle(
  from: number,
  to: number,
  velocityPxPerS: number,
  config: Partial<SpringConfig> | undefined,
): SettleSamples {
  const cfg = { ...DEFAULT_SPRING, ...config };
  const subDt = 1 / SIM_HZ;
  const stepMs = (SAMPLE_STRIDE / SIM_HZ) * 1000;
  const maxSteps = Math.ceil((MAX_SIM_MS / 1000) * SIM_HZ);
  const values: number[] = [from];
  let x = from;
  let v = velocityPxPerS;
  for (let i = 1; i <= maxSteps; i += 1) {
    const force = -cfg.stiffness * (x - to) - cfg.damping * v;
    v += (force / cfg.mass) * subDt;
    x += v * subDt;
    if (!Number.isFinite(x) || !Number.isFinite(v)) {
      values.push(to);
      break;
    }
    if (i % SAMPLE_STRIDE === 0) values.push(x);
    const atRest =
      Math.abs(to - x) < (cfg.restDelta ?? 0.5) &&
      Math.abs(v) < (cfg.restSpeed ?? 0.5);
    if (atRest) break;
  }
  if (values[values.length - 1] !== to) values.push(to);
  return {
    values,
    stepMs,
    durationMs: (values.length - 1) * stepMs,
  };
}

export function sampleTweenSettle(
  from: number,
  to: number,
  durationMs: number,
  easing: (t: number) => number,
): SettleSamples {
  const count = Math.max(2, Math.min(60, Math.round(durationMs / 16)));
  const values: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    values.push(from + (to - from) * easing(t));
  }
  values[values.length - 1] = to;
  return {
    values,
    stepMs: durationMs / count,
    durationMs,
  };
}
