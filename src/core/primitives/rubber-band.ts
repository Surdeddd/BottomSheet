const RUBBER_BAND_FACTOR = 0.55;

export function rubberBand(overshoot: number, maxAxisSize: number): number {
  const cap = Math.min(maxAxisSize * 0.15, 80);
  return (
    Math.sign(overshoot) *
    Math.pow(Math.abs(overshoot), RUBBER_BAND_FACTOR) *
    Math.min(6, cap / Math.max(Math.abs(overshoot), 1))
  );
}
