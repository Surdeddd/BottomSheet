import { resolveSnap } from "./cssLength";
import { devWarn } from "./devWarn";
import type { SheetMode, SnapPoint, SnapPointDef } from "../types";

export { resolveSnap };

export type ResolvedSnap = { id: string; size: number };

export const resolveSnapList = (
  points: SnapPointDef[],
  mode: SheetMode,
  measureFit?: () => number,
): ResolvedSnap[] =>
  points
    .map(p => {
      const raw = resolveSnap(p.size, mode, measureFit);

      if (!Number.isFinite(raw) || raw < 0) {
        devWarn(
          `[BottomSheet] snap "${p.id}" resolved to invalid size (${String(p.size)} → ${raw}); clamped to 0.`,
        );
        return { id: p.id, size: 0 };
      }
      return { id: p.id, size: raw };
    })
    .sort((a, b) => a.size - b.size);

const VH_NOT_DVH = /(^|[^a-z])vh\b/i;

export const auditVhUsage = (points: SnapPointDef[]): void => {
  for (const p of points) {
    if (typeof p.size !== "string") continue;
    if (!VH_NOT_DVH.test(p.size)) continue;
    devWarn(
      `[BottomSheet] snap "${p.id}" uses "vh" — prefer "dvh" on mobile ` +
        `(iOS Safari URL bar makes vh unstable). ` +
        `See https://web.dev/blog/viewport-units`,
    );
  }
};

export const findNearest = (
  size: number,
  resolved: ResolvedSnap[],
  allowed: string[],
  direction: 1 | -1 | 0 = 0,
  bias: number = 0,
): ResolvedSnap | null => {
  const pool = resolved.filter(p => allowed.includes(p.id));
  if (pool.length === 0) return null;
  const target = size + direction * bias;
  let best = pool[0]!;
  let bestDist = Math.abs(target - best.size);
  for (let i = 1; i < pool.length; i++) {
    const cand = pool[i]!;
    const dist = Math.abs(target - cand.size);
    if (dist < bestDist) {
      best = cand;
      bestDist = dist;
    }
  }
  return best;
};

export const allowedRange = (
  resolved: ResolvedSnap[],
  allowed: string[],
): { min: number; max: number } => {
  const pool = resolved.filter(p => allowed.includes(p.id));
  if (pool.length === 0) return { min: 0, max: 0 };
  return {
    min: pool[0]!.size,
    max: pool[pool.length - 1]!.size,
  };
};

export const findById = (
  id: string,
  resolved: ResolvedSnap[],
): ResolvedSnap | null => resolved.find(p => p.id === id) ?? null;

export type SettleTargetInput = {
  delta: number;
  velocity: number;
  pointerKind: "touch" | "mouse" | "pen";
  size: number;
  resolved: ResolvedSnap[];
  allowed: string[];
  activeId: string;
  maxAxisSize: number;

  flickVelocity: number;

  dragThreshold: number;
};

const MOUSE_FLICK_VELOCITY = 0.4;
const MOUSE_DRAG_THRESHOLD = 12;
const DIRECTIONAL_INTENT_VELOCITY = 0.15;

export const findDragSettleTarget = (
  input: SettleTargetInput,
): ResolvedSnap | null => {
  const speed = Math.abs(input.velocity);

  const flickThreshold =
    input.pointerKind === "mouse"
      ? MOUSE_FLICK_VELOCITY
      : input.flickVelocity;
  const dragThresh =
    input.pointerKind === "mouse"
      ? MOUSE_DRAG_THRESHOLD
      : input.dragThreshold;

  let direction: 1 | -1 | 0 = 0;
  if (speed > flickThreshold || speed > DIRECTIONAL_INTENT_VELOCITY) {
    direction = input.velocity > 0 ? 1 : -1;
  }

  if (Math.abs(input.delta) < dragThresh && direction === 0) {
    return findById(input.activeId, input.resolved);
  }

  const speedBias =
    speed > flickThreshold ? Math.min(speed * 180, input.maxAxisSize) : 0;
  return findNearest(
    input.size,
    input.resolved,
    input.allowed,
    direction,
    speedBias,
  );
};
