export const LAYER_COUNT = 5;

export const SNAP_PEEK = 0.16;
export const SNAP_HALF = 0.46;
export const SNAP_FULL = 0.88;

export type StageSpan = { stickStart: number; stickEnd: number };

const LIFT_FROM = 0.42;
const LIFT_STAGGER = 0.045;
const LIFT_SPAN = 0.36;
const DOCK_FROM = 0.05;
const DOCK_SPAN = 0.16;
const LIT_AT = 0.6;
const HOLD_FROM = 0.05;
const OPEN_AT = 0.9;

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

export const smooth = (v: number): number => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

export const travelAt = (scrollY: number, span: StageSpan): number =>
  span.stickStart <= 0 ? 1 : clamp01(scrollY / span.stickStart);

export const buildAt = (scrollY: number, span: StageSpan): number => {
  const range = span.stickEnd - span.stickStart;
  return range <= 0 ? 0 : clamp01((scrollY - span.stickStart) / range);
};

const liftedAt = (travel: number, index: number): number =>
  smooth(
    (travel - LIFT_FROM - (LAYER_COUNT - 1 - index) * LIFT_STAGGER) / LIFT_SPAN,
  );

const dockPhase = (build: number, index: number): number =>
  clamp01((build - DOCK_FROM - index * DOCK_SPAN) / DOCK_SPAN);

export const layerLift = (
  travel: number,
  build: number,
  index: number,
): number => liftedAt(travel, index) * (1 - smooth(dockPhase(build, index)));

export const litCount = (build: number): number => {
  let lit = 0;
  for (let i = 0; i < LAYER_COUNT; i++) {
    if (smooth(dockPhase(build, i)) >= LIT_AT) lit++;
  }
  return lit;
};

export const focusOf = (build: number, index: number): number => {
  const t = dockPhase(build, index);
  return 4 * t * (1 - t);
};

export const sheetFraction = (
  travel: number,
  build: number,
  idle: number,
): number => {
  if (build >= OPEN_AT) return SNAP_FULL;
  return travel > HOLD_FROM ? SNAP_HALF : idle;
};
