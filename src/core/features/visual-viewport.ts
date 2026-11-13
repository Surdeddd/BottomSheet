import { sameSeat, seatOf } from "./resize-observer";

const SAFETY_PAD = 8;
const KEYBOARD_MIN_INSET = 1;

export type VisualViewportDeps = {
  isVerticalAxis: () => boolean;
  isDestroyed: () => boolean;
  recomputeSnaps: () => void;
  resolveActiveSnap: () => { id: string; size: number } | null;
  getMaxAxisSize: () => number;
  setMaxAxisSize: (size: number) => void;
  reseat: () => void;
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
      const before = seatOf(deps);
      deps.recomputeSnaps();
      const isVertical = deps.isVerticalAxis();
      const visible = isVertical ? vv.height : vv.width;
      const windowSize = isVertical ? window.innerHeight : window.innerWidth;
      const pad = windowSize - visible > KEYBOARD_MIN_INSET ? SAFETY_PAD : 0;
      const clamp = Math.max(0, Math.min(windowSize, visible) - pad);
      if (clamp < deps.getMaxAxisSize()) {
        deps.setMaxAxisSize(clamp);
      }
      if (sameSeat(before, seatOf(deps))) return;
      deps.reseat();
    });
  };
  vv.addEventListener("resize", onResize);
  return () => {
    vv.removeEventListener("resize", onResize);
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}
