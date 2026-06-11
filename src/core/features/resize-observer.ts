import type { TransformAxis } from "../primitives/transform";
import type { ResolvedSnap } from "../primitives/snap-points";

export type ResizeObserverDeps = {
  element: HTMLElement;
  getMode: () => TransformAxis;
  isDestroyed: () => boolean;
  isDragging: () => boolean;
  resolveActiveSnap: () => ResolvedSnap | null;
  getMaxAxisSize: () => number;
  getSize: () => number;
  setMaxAxisSize: (size: number) => void;
  setSize: (size: number) => void;
  recomputeSnaps: () => void;
  applySize: (size: number) => void;
  cancelInFlight: () => void;
  newCycle: () => void;
  isAnimating?: () => boolean;
  resyncAfterCancel?: () => void;
};

export function installResizeObserver(deps: ResizeObserverDeps): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onResize = (): void => {
    if (deps.isDestroyed()) return;
    deps.recomputeSnaps();
    const mode = deps.getMode();
    const isVerticalAxis = mode === "bottom" || mode === "top";
    const viewportSize = isVerticalAxis
      ? window.innerHeight
      : window.innerWidth;
    const max = deps.getMaxAxisSize();
    if (viewportSize > 0 && viewportSize < max) {
      deps.setMaxAxisSize(viewportSize);
    }
    const wasAnimating = deps.isAnimating?.() ?? false;
    deps.cancelInFlight();
    deps.newCycle();

    const current = deps.resolveActiveSnap();
    const newMax = deps.getMaxAxisSize();
    const targetSize = current
      ? Math.min(current.size, newMax)
      : Math.min(deps.getSize(), newMax);
    deps.setSize(targetSize);
    if (current && !deps.isDragging()) {
      deps.applySize(targetSize);
      if (wasAnimating) deps.resyncAfterCancel?.();
    }
  };

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(document.documentElement);
  } else {
    window.addEventListener("resize", onResize);
  }
  window.addEventListener("orientationchange", onResize);

  const onVisibility = (): void => {
    if (deps.isDestroyed()) return;
    if (document.hidden) deps.cancelInFlight();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
