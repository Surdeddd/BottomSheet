import type { TransformAxis } from "../primitives/transform";
import type { ResolvedSnap } from "../primitives/snap-points";
import { SIZE_WRITE_EPSILON } from "../primitives/hot-path-thresholds";

export type Seat = { target: number | null; max: number };

export type SeatDeps = {
  resolveActiveSnap: () => { id: string; size: number } | null;
  getMaxAxisSize: () => number;
};

export const seatOf = (deps: SeatDeps): Seat => {
  const snap = deps.resolveActiveSnap();
  const max = deps.getMaxAxisSize();
  return { target: snap ? Math.min(snap.size, max) : null, max };
};

export const sameSeat = (before: Seat, after: Seat): boolean =>
  before.target !== null &&
  after.target !== null &&
  Math.abs(after.target - before.target) < SIZE_WRITE_EPSILON &&
  Math.abs(after.max - before.max) < SIZE_WRITE_EPSILON;

export type ResizeObserverDeps = {
  element: HTMLElement;
  getMode: () => TransformAxis;
  isDestroyed: () => boolean;
  resolveActiveSnap: () => ResolvedSnap | null;
  getMaxAxisSize: () => number;
  setMaxAxisSize: (size: number) => void;
  recomputeSnaps: () => void;
  reseat: () => void;
  landNow: () => void;
};

export function installResizeObserver(deps: ResizeObserverDeps): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onResize = (): void => {
    if (deps.isDestroyed()) return;
    const before = seatOf(deps);
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
    if (sameSeat(before, seatOf(deps))) return;
    deps.reseat();
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
    if (document.hidden) deps.landNow();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
