export type ContentGestureDecision = "drag" | "scroll" | "pending";

export const CONTENT_DRAG_SLOP = 6;

export type ContentGestureInput = {

  delta: number;
  scrollTop: number;
  atMaxSnap: boolean;
  slop?: number;

  crossDelta?: number;
  sharesScrollAxis?: boolean;
};

export function decideContentGesture(
  input: ContentGestureInput,
): ContentGestureDecision {
  const slop = input.slop ?? CONTENT_DRAG_SLOP;
  const cross = input.crossDelta ?? 0;
  const sharesScrollAxis = input.sharesScrollAxis ?? true;

  if (!sharesScrollAxis) {
    if (Math.abs(input.delta) < slop && Math.abs(cross) < slop) return "pending";
    if (Math.abs(input.delta) <= Math.abs(cross)) return "scroll";
    return "drag";
  }

  if (Math.abs(input.delta) < slop) return "pending";
  if (input.scrollTop > 0) return "scroll";
  if (input.delta > 0 && input.atMaxSnap) return "scroll";
  return "drag";
}
