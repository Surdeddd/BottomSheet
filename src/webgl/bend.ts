export type Bend = {
  step: (position: number, now: number) => number;
  reset: (position: number, now: number) => void;
  rest: () => boolean;
};

export type BendOptions = {
  jelly: number;
  inward: 1 | -1;
};

const OMEGA = 0.022;
const ZETA = 0.55;
const GAIN = 0.5;
const OUTWARD_PX = 22;
const INWARD_PX = 8;
const SUBSTEP_MS = 4;
const MAX_GAP_MS = 1000;
const REST_PX = 0.3;
const REST_SPEED = 0.005;

export const createBend = (options: BendOptions): Bend => {
  const gain = Math.max(0, options.jelly) * GAIN;
  let corner = 0;
  let centre = 0;
  let speed = 0;
  let time = 0;

  const shape = (): number => {
    const raw = (corner - centre) * gain;
    if (raw === 0) return 0;
    const limit = Math.sign(raw) === options.inward ? INWARD_PX : OUTWARD_PX;
    return limit * Math.tanh(raw / limit);
  };

  const reset = (position: number, now: number): void => {
    corner = position;
    centre = position;
    speed = 0;
    time = now;
  };

  return {
    reset,
    step: (position, now) => {
      const gap = now - time;
      if (gain === 0 || gap > MAX_GAP_MS) {
        reset(position, now);
        return 0;
      }
      if (gap <= 0) {
        centre = position;
        return shape();
      }
      const steps = Math.ceil(gap / SUBSTEP_MS);
      const h = gap / steps;
      const from = centre;
      for (let i = 1; i <= steps; i++) {
        const target = from + ((position - from) * i) / steps;
        speed +=
          (OMEGA * OMEGA * (target - corner) - 2 * ZETA * OMEGA * speed) * h;
        corner += speed * h;
      }
      centre = position;
      time = now;
      return shape();
    },
    rest: () =>
      Math.abs(corner - centre) * gain < REST_PX &&
      Math.abs(speed) < REST_SPEED,
  };
};
