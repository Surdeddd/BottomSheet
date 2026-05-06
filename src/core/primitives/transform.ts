/** Re-aliased as `SheetMode` in `types.ts` and as `OverlayEdge` in `overlay.ts`. */
export type TransformAxis = "bottom" | "top" | "left" | "right";

/**
 * Build a translate-template function for a given axis. The returned fn
 * maps an offset (px) to a `translate3d(...)` string. Axis is fixed for
 * the life of the engine, so the switch runs ONCE in the constructor and
 * the hot path is just a template-literal call.
 *
 * Sign conventions:
 *   - bottom: positive offset → push down (away from settled position)
 *   - top:    positive offset → push up
 *   - left:   positive offset → push left
 *   - right:  positive offset → push right
 *
 * The engine passes `offset = maxAxisSize - currentSize` so a fully-open
 * sheet (size === maxAxisSize) has `offset === 0` (settled) and a closed
 * sheet has `offset === maxAxisSize` (offscreen).
 */
export function buildTransformTemplate(
  axis: TransformAxis,
): (offset: number) => string {
  switch (axis) {
    case "bottom":
      return offset => `translate3d(0, ${offset}px, 0)`;
    case "top":
      return offset => `translate3d(0, ${-offset}px, 0)`;
    case "left":
      return offset => `translate3d(${-offset}px, 0, 0)`;
    case "right":
      return offset => `translate3d(${offset}px, 0, 0)`;
  }
}

/**
 * Closed-position transform — used by overlay primitives that animate
 * between fully-open (translate3d(0,0,0)) and fully-closed (offscreen by
 * 100% along the relevant axis). The argument is symmetric with `axis`
 * in `buildTransformTemplate`; for overlays we use the term "edge" since
 * there's no concept of partial snaps.
 */
export const CLOSED_TRANSFORM: Record<TransformAxis, string> = {
  bottom: "translate3d(0, 100%, 0)",
  top: "translate3d(0, -100%, 0)",
  left: "translate3d(-100%, 0, 0)",
  right: "translate3d(100%, 0, 0)",
};

/**
 * Resolve the layout axis (CSS dimension) the engine writes to for a given
 * sheet mode. `bottom`/`top` constrain HEIGHT; `left`/`right` constrain
 * WIDTH. Used by recomputeSnaps + visualViewport when clamping the host
 * element's max axis dimension.
 */
export const layoutAxis = (axis: TransformAxis): "height" | "width" =>
  axis === "left" || axis === "right" ? "width" : "height";
