export function rubberBand(overshoot: number, maxAxisSize: number): number {
  const cap = Math.min(maxAxisSize * 0.15, 80);
  if (cap <= 0) return 0;
  const abs = Math.abs(overshoot);
  return Math.sign(overshoot) * ((cap * abs) / (abs + cap));
}
