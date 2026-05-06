/**
 * Stable per-instance identifier shared by `BottomSheetEngine` and
 * `OverlayEngine`. Prefers `crypto.randomUUID()` when available (modern
 * browsers, Node 19+, happy-dom) so SSR boots produce unique ids without
 * mutating module state — a counter would collide across hydration passes
 * on the same render. Falls back to a counter for environments where
 * `crypto.randomUUID` is missing (older Node, jsdom < v22).
 *
 * Each prefix gets its own counter so engine + overlay ids stay distinct
 * in the fallback path: `bs-1` / `ovl-1` rather than colliding on a shared
 * sequence.
 */

const counters: Record<string, number> = {};

export function nextInstanceId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  return `${prefix}-${counters[prefix]}`;
}
