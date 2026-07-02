import type { OverlayEdge } from "../primitives/overlay-transforms";

export type OverlaySwipeDeps = {
  element: HTMLElement;
  edge: OverlayEdge;
  getThreshold: () => number;
  getVelocityThreshold: () => number;
  getExitTransition: () => string;
  getOpenTransform: () => string;
  close: () => void;
};

export function installOverlaySwipe(deps: OverlaySwipeDeps): () => void {
  const el = deps.element;
  const edge = deps.edge;
  const isVertical = edge === "bottom" || edge === "top";
  const sign = edge === "bottom" || edge === "right" ? 1 : -1;
  const SLOP = 8;
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let tracking = false;
  let dragging = false;
  let pointerId: number | null = null;
  const previousTouchAction = el.style.touchAction;
  el.style.touchAction = isVertical ? "pan-x" : "pan-y";
  const onDown = (e: PointerEvent): void => {
    if (e.button !== undefined && e.button !== 0) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startT = performance.now();
    tracking = true;
    dragging = false;
  };
  const onMove = (e: PointerEvent): void => {
    if (!tracking || e.pointerId !== pointerId) return;
    const delta = isVertical ? e.clientY - startY : e.clientX - startX;
    if (!dragging) {
      if (Math.abs(delta) < SLOP) return;
      dragging = true;
      el.style.transition = "none";
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
      }
    }
    const offset = Math.max(0, sign * delta);
    el.style.transform = isVertical
      ? `translate3d(0, ${sign * offset}px, 0)`
      : `translate3d(${sign * offset}px, 0, 0)`;
  };
  const finish = (e: PointerEvent): void => {
    if (!tracking || e.pointerId !== pointerId) return;
    tracking = false;
    pointerId = null;
    if (!dragging) return;
    dragging = false;
    const dt = performance.now() - startT || 1;
    const delta = isVertical ? e.clientY - startY : e.clientX - startX;
    const offset = Math.max(0, sign * delta);
    const velocity = (sign * delta) / dt;
    const size = isVertical ? el.offsetHeight : el.offsetWidth;
    const past =
      offset > size * deps.getThreshold() ||
      velocity > deps.getVelocityThreshold();
    el.style.transition = deps.getExitTransition();
    if (past) {
      deps.close();
    } else {
      el.style.transform = deps.getOpenTransform();
    }
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", finish);
  return () => {
    el.style.touchAction = previousTouchAction;
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", finish);
    el.removeEventListener("pointercancel", finish);
  };
}
