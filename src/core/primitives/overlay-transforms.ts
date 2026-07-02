import { CLOSED_TRANSFORM, type TransformAxis } from "./transform";

export type OverlayEdge = TransformAxis;

export type OverlayAnimation = "slide" | "fade" | "scale";

export const closedTransform = (edge: OverlayEdge): string =>
  CLOSED_TRANSFORM[edge];

export const closedTransformFor = (
  edge: OverlayEdge,
  animation: OverlayAnimation,
  peekPx?: number,
): string => {
  switch (animation) {
    case "fade":
      return "translate3d(0, 0, 0)";
    case "scale":
      return "translate3d(0, 0, 0) scale(0.94)";
    case "slide":
    default:
      if (peekPx !== undefined && edge === "bottom") {
        return `translate3d(0, calc(100% - ${peekPx}px), 0)`;
      }
      return closedTransform(edge);
  }
};

export const openTransformFor = (animation: OverlayAnimation): string =>
  animation === "scale"
    ? "translate3d(0, 0, 0) scale(1)"
    : "translate3d(0, 0, 0)";
