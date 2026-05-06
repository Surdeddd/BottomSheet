/**
 * Per-frame CSSOM-write dedup thresholds. The engine's drag/animate path runs
 * at 60-120 Hz; gating writes by these epsilons drops 30-50% of CSSOM/style
 * recalc work during the spring's settle tail without a perceptible visual
 * change. Sub-pixel deltas + sub-1% opacity diffs are below human perception
 * AND below most display gamma curves.
 *
 * Centralized here so engine + ScrimController + future controllers all read
 * the same values — preventing drift when one half of the codebase tightens
 * a threshold and the other doesn't.
 *
 * @internal
 */

/** Sub-pixel size delta below which `--bs-size` write is skipped. */
export const SIZE_WRITE_EPSILON = 0.5;

/** Sub-1% opacity / progress delta below which CSSOM writes are skipped. */
export const OPACITY_WRITE_EPSILON = 0.005;

/** Backdrop opacity threshold for switching `pointer-events: auto` ↔ `none`. */
export const POINTER_EVENTS_OPACITY_THRESHOLD = 0.05;

/** Floor for range-mapping division (prevents div-by-zero on `[s, s]`). */
export const RANGE_DIVISION_EPSILON = 0.0001;
