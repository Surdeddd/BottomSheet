import { resolveSnap } from "./cssLength";
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
      // Defensive clamp: malformed CSS strings ("asdf"), negative calc()
      // results, or environments where the probe element fails to mount can
      // yield NaN or negative sizes. Both poison `applySize` (NaN → silently-
      // rejected `transform: translate3d(0, NaNpx, 0)`; negative → sheet
      // off-axis). Fall back to 0 + warn so the consumer can fix the input.
      if (!Number.isFinite(raw) || raw < 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[BottomSheet] snap "${p.id}" resolved to invalid size (${String(p.size)} → ${raw}); clamped to 0.`,
        );
        return { id: p.id, size: 0 };
      }
      return { id: p.id, size: raw };
    })
    .sort((a, b) => a.size - b.size);

// Matches `vh` but not `dvh`/`lvh`/`svh`. We avoid lookbehind here because
// Safari < 16.4 / older WebViews throw a SyntaxError when parsing the regex
// literal — that would surface as a hard `new BottomSheetEngine()` failure on
// otherwise-supported browsers. Instead: capture an optional preceding letter
// and reject when it's present at the call site.
const VH_NOT_DVH = /(^|[^a-z])vh\b/i;

/**
 * Warn on snap sizes that use legacy `vh` — on iOS Safari it resolves to
 * the LARGE viewport height, which goes stale when the URL bar reappears
 * and leaves the sheet in the wrong place. Call once per engine init; the
 * engine's recompute path skips this so resize/orientationchange doesn't
 * spam the console.
 */
export const auditVhUsage = (points: SnapPointDef[]): void => {
  for (const p of points) {
    if (typeof p.size !== "string") continue;
    if (!VH_NOT_DVH.test(p.size)) continue;
    // eslint-disable-next-line no-console
    console.warn(
      `[BottomSheet] snap "${p.id}" uses "vh" — prefer "dvh" on mobile ` +
        `(iOS Safari URL bar makes vh unstable). ` +
        `See https://web.dev/blog/viewport-units`,
    );
  }
};

/**
 * Finds the snap point closest to `size`, optionally biased by drag
 * direction (positive = expanding) so flicks settle on the next-up snap
 * even when geometrically closer to the previous one.
 */
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

/**
 * Pure drag-settle target resolution. Given a drag-end's `delta`, `velocity`,
 * and `pointerKind`, plus the engine's current snap state, returns the snap
 * the gesture should settle on — OR `null` to indicate "stay where you are"
 * (sub-threshold drag with no directional intent).
 *
 * Extracted from `BottomSheetEngine.settleAfterDrag` so the policy is unit-
 * testable in isolation. The engine wraps the result with side-effectful
 * pieces (before-snap emit, scroll-cache, animateTo, snap event, haptic,
 * open/close lifecycle) — those stay engine-internal because they're tied
 * to mutable engine state.
 *
 * Velocity sign convention: positive = sheet GREW (drag opened it).
 * Direction sign convention matches the input direction parameter of
 * `findNearest` — positive = expanding, negative = collapsing.
 */
export type SettleTargetInput = {
  delta: number;
  velocity: number;
  pointerKind: "touch" | "mouse" | "pen";
  size: number;
  resolved: ResolvedSnap[];
  allowed: string[];
  activeId: string;
  maxAxisSize: number;
  /** Touch threshold in px/ms (mouse uses 0.4 hardcoded). */
  flickVelocity: number;
  /** Touch drag threshold in px (mouse uses 12 hardcoded). */
  dragThreshold: number;
};

const MOUSE_FLICK_VELOCITY = 0.4;
const MOUSE_DRAG_THRESHOLD = 12;
const DIRECTIONAL_INTENT_VELOCITY = 0.15;

export const findDragSettleTarget = (
  input: SettleTargetInput,
): ResolvedSnap | null => {
  const speed = Math.abs(input.velocity);
  // Mouse/trackpad has finer pixel control than touch, so lower thresholds.
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

  // Sub-threshold drag with no directional intent — stay on current snap.
  if (Math.abs(input.delta) < dragThresh && direction === 0) {
    return findById(input.activeId, input.resolved);
  }

  // Above-threshold OR directional intent — find nearest with optional
  // speed-bias so a flick "carries" past geometrically closer snaps.
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
