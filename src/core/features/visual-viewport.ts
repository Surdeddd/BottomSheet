/**
 * Track soft-keyboard appearance via the VisualViewport API. iOS doesn't
 * shrink `window.innerHeight` when the keyboard opens — but
 * `visualViewport.height` does. So we recompute snaps and clamp the
 * sheet's `maxAxisSize` against the visible area to keep the sheet above
 * the keyboard.
 *
 * Listens to `resize` only; `scroll` fires constantly during iOS rubber-
 * band and would over-correct. Resize handler is RAF-coalesced so a noisy
 * rubber-band burst collapses to one snap recompute per frame.
 *
 * No-ops cleanly when `visualViewport` is unavailable (older browsers,
 * SSR) — returns a no-op teardown so the engine can call this
 * unconditionally.
 */

const SAFETY_PAD = 8;

export type VisualViewportDeps = {
  /** Sheet root element — used to set the clamped axis style. */
  element: HTMLElement;
  /** "bottom" | "top" → vertical axis; "left" | "right" → horizontal. */
  isVerticalAxis: () => boolean;
  /** Live engine state. */
  isDestroyed: () => boolean;
  isDragging: () => boolean;
  /** Force a snap geometry refresh — runs before clamping. */
  recomputeSnaps: () => void;
  /** Resolve the active snap id to size (for animation target reconciliation). */
  resolveActiveSnap: () => { id: string; size: number } | null;
  /** Live engine size getters. */
  getMaxAxisSize: () => number;
  getSize: () => number;
  /** Mutators — installer drives these as the keyboard arrives/leaves. */
  setMaxAxisSize: (size: number) => void;
  setSize: (size: number) => void;
  applySize: (size: number) => void;
};

export function installVisualViewport(deps: VisualViewportDeps): () => void {
  if (typeof window === "undefined" || !window.visualViewport) {
    return () => {};
  }
  const vv = window.visualViewport;
  let rafId: number | null = null;

  const onResize = (): void => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (deps.isDestroyed()) return;
      deps.recomputeSnaps();
      const isVertical = deps.isVerticalAxis();
      const visible = isVertical ? vv.height : vv.width;
      const windowSize = isVertical ? window.innerHeight : window.innerWidth;
      const clamp = Math.max(0, Math.min(windowSize, visible) - SAFETY_PAD);
      if (clamp < deps.getMaxAxisSize()) {
        // setMaxAxisSize fires SnapResolver's onMaxAxisSizeChange callback,
        // which writes element.style[layoutAxis(mode)] — resolver owns the
        // layout-axis style end-to-end (m9). No inline write here.
        deps.setMaxAxisSize(clamp);
      }
      const max = deps.getMaxAxisSize();
      deps.setSize(Math.min(deps.getSize(), max));
      const current = deps.resolveActiveSnap();
      if (current && !deps.isDragging()) {
        deps.applySize(Math.min(current.size, max));
      } else {
        deps.applySize(deps.getSize());
      }
    });
  };
  vv.addEventListener("resize", onResize);
  return () => {
    vv.removeEventListener("resize", onResize);
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}
