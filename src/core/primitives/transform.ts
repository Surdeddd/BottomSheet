export type TransformAxis = "bottom" | "top" | "left" | "right";

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

export const CLOSED_TRANSFORM: Record<TransformAxis, string> = {
  bottom: "translate3d(0, 100%, 0)",
  top: "translate3d(0, -100%, 0)",
  left: "translate3d(-100%, 0, 0)",
  right: "translate3d(100%, 0, 0)",
};

export const layoutAxis = (axis: TransformAxis): "height" | "width" =>
  axis === "left" || axis === "right" ? "width" : "height";
