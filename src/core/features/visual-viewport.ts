const SAFETY_PAD = 8;

export type VisualViewportDeps = {
  element: HTMLElement;
  isVerticalAxis: () => boolean;
  isDestroyed: () => boolean;
  isDragging: () => boolean;
  recomputeSnaps: () => void;
  resolveActiveSnap: () => { id: string; size: number } | null;
  getMaxAxisSize: () => number;
  getSize: () => number;
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
