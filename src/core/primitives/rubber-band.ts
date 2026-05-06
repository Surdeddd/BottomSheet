const RUBBER_BAND_FACTOR = 0.55;

/**
 * iOS-style rubber-band resistance: `pow(overshoot, 0.55)` scaled by sheet
 * range with a soft cap. `maxAxisSize` provides the geometry bound — the
 * rubber-band cap is the smaller of `maxAxisSize * 0.15` and 80px so a tall
 * sheet doesn't stretch a full screen-height worth of rubber.
 *
 * Pure function — no side effects, no engine state. Returned value is
 * signed (preserves direction of overshoot).
 */
export function rubberBand(overshoot: number, maxAxisSize: number): number {
  const cap = Math.min(maxAxisSize * 0.15, 80);
  return (
    Math.sign(overshoot) *
    Math.pow(Math.abs(overshoot), RUBBER_BAND_FACTOR) *
    Math.min(6, cap / Math.max(Math.abs(overshoot), 1))
  );
}
