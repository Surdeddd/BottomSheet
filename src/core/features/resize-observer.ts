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
};

/**
 * Watch viewport / element resize + orientation change. Recomputes resolved
 * snaps and clamps maxAxisSize against the live viewport so the sheet element
 * doesn't overflow on mobile address-bar collapse / soft-keyboard / window
 * resize. Also bumps the cycle invariant so any in-flight snapTo from before
 * the resize doesn't fire its post-await emit against the new geometry.
 *
 * @internal
 */
export function installResizeObserver(deps: ResizeObserverDeps): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onResize = (): void => {
    if (deps.isDestroyed()) return;
    deps.recomputeSnaps();
    // recomputeSnaps sets maxAxisSize to the LARGEST resolved snap. On mobile
    // address-bar collapse / window resize / soft keyboard, the window itself
    // can be smaller than the largest snap — clamp maxAxisSize against the
    // actual viewport so the sheet element's sized box doesn't overflow.
    const mode = deps.getMode();
    const isVerticalAxis = mode === "bottom" || mode === "top";
    const viewportSize = isVerticalAxis
      ? window.innerHeight
      : window.innerWidth;
    const max = deps.getMaxAxisSize();
    if (viewportSize > 0 && viewportSize < max) {
      // setMaxAxisSize fires SnapResolver's onMaxAxisSizeChange callback,
      // which writes element.style[layoutAxis(mode)] — resolver owns the
      // layout-axis style end-to-end (m9). No inline write here.
      deps.setMaxAxisSize(viewportSize);
    }
    // Cancel in-flight animation + bump cycle so post-await emit("snap") from
    // the prior cycle doesn't fire against the new viewport, and so the
    // running animation doesn't overwrite our clamped applySize next frame.
    deps.cancelInFlight();
    deps.newCycle();

    const current = deps.resolveActiveSnap();
    const newMax = deps.getMaxAxisSize();
    const targetSize = current
      ? Math.min(current.size, newMax)
      : Math.min(deps.getSize(), newMax);
    deps.setSize(targetSize);
    if (current && !deps.isDragging()) deps.applySize(targetSize);
  };

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(document.documentElement);
  } else {
    window.addEventListener("resize", onResize);
  }
  window.addEventListener("orientationchange", onResize);

  // Avoids time-warp jumps when the user returns from a backgrounded tab —
  // we cancel any in-flight animation so the next snapTo starts fresh.
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
