import type { TransformAxis } from "./transform";

export type LogicalAxis = "start" | "end";
export type AnyMode = TransformAxis | LogicalAxis;

export const isLogicalMode = (mode: AnyMode): mode is LogicalAxis =>
  mode === "start" || mode === "end";

export const readDirection = (el: Element | null | undefined): "ltr" | "rtl" => {
  if (!el) return "ltr";
  if (typeof getComputedStyle === "function") {
    try {
      if (getComputedStyle(el).direction === "rtl") return "rtl";
    } catch {
      void 0;
    }
  }
  try {
    const marked = el.closest?.("[dir]");
    if (marked) {
      return marked.getAttribute("dir")?.toLowerCase() === "rtl"
        ? "rtl"
        : "ltr";
    }
  } catch {
    void 0;
  }
  return "ltr";
};

export const resolveMode = (
  mode: AnyMode,
  el: Element | null | undefined,
): TransformAxis => {
  if (!isLogicalMode(mode)) return mode;
  const rtl = readDirection(el) === "rtl";
  if (mode === "start") return rtl ? "right" : "left";
  return rtl ? "left" : "right";
};
