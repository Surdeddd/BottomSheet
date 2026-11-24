import { sameSeat, seatOf } from "./resize-observer";

const SAFETY_PAD = 8;
const KEYBOARD_MIN_INSET = 1;
const KEYBOARD_MIN_COVER = 60;
const ZOOMED = 1.01;

export type VisualViewportDeps = {
  isVerticalAxis: () => boolean;
  isDestroyed: () => boolean;
  recomputeSnaps: () => void;
  resolveActiveSnap: () => { id: string; size: number } | null;
  getMaxAxisSize: () => number;
  setMaxAxisSize: (size: number) => void;
  setKeyboardInset: (px: number) => void;
  setViewportCap: (size: number) => void;
  reseat: () => void;
};

export function installVisualViewport(deps: VisualViewportDeps): () => void {
  if (typeof window === "undefined" || !window.visualViewport) {
    return () => {};
  }
  const vv = window.visualViewport;
  let rafId: number | null = null;

  const coveredByKeyboard = (): number => {
    if ((vv.scale || 1) > ZOOMED) return 0;
    const covered = window.innerHeight - ((vv.offsetTop || 0) + vv.height);
    return covered >= KEYBOARD_MIN_COVER ? Math.round(covered) : 0;
  };

  const onResize = (): void => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (deps.isDestroyed()) return;
      deps.setKeyboardInset(coveredByKeyboard());
      const before = seatOf(deps);
      const isVertical = deps.isVerticalAxis();
      const visible = isVertical ? vv.height : vv.width;
      const windowSize = isVertical ? window.innerHeight : window.innerWidth;
      const shrunk = windowSize - visible > KEYBOARD_MIN_INSET;
      const clamp = Math.max(
        0,
        Math.min(windowSize, visible) - (shrunk ? SAFETY_PAD : 0),
      );
      deps.setViewportCap(shrunk ? clamp : 0);
      deps.recomputeSnaps();
      if (clamp < deps.getMaxAxisSize()) {
        deps.setMaxAxisSize(clamp);
      }
      if (sameSeat(before, seatOf(deps))) return;
      deps.reseat();
    });
  };
  vv.addEventListener("resize", onResize);
  vv.addEventListener("scroll", onResize);
  return () => {
    vv.removeEventListener("resize", onResize);
    vv.removeEventListener("scroll", onResize);
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}
