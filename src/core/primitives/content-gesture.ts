export type ContentGestureDecision = "drag" | "scroll" | "pending";

export const CONTENT_DRAG_SLOP = 6;

export type ContentGestureInput = {
  /** Positive grows the sheet, negative shrinks it. */
  delta: number;
  scrollTop: number;
  atMaxSnap: boolean;
  slop?: number;
};

/**
 * A content gesture drives the sheet only while the scroller sits at its top;
 * anywhere else the browser keeps the scroll.
 */
export function decideContentGesture(
  input: ContentGestureInput,
): ContentGestureDecision {
  const slop = input.slop ?? CONTENT_DRAG_SLOP;
  if (Math.abs(input.delta) < slop) return "pending";
  if (input.scrollTop > 0) return "scroll";
  if (input.delta > 0 && input.atMaxSnap) return "scroll";
  return "drag";
}
