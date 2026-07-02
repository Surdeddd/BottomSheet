import { layoutAxis, type TransformAxis } from "../primitives/transform";
import type { SheetMode } from "../types";

export type FitMeasurementDeps = {
  element: HTMLElement;
  scrollContainer: HTMLElement | undefined;
  mode: SheetMode;
  getMaxHeightCap: () => number | undefined;
};

export const measureSheetNatural = (
  element: HTMLElement,
  content: HTMLElement | undefined,
  vertical: boolean,
): number => {
  if (!content) {
    return vertical ? element.offsetHeight : element.offsetWidth;
  }
  const axis = vertical ? "height" : "width";
  const sheetStyle = element.style;
  const cs = content.style;
  const prevSheet = sheetStyle[axis];
  const prevFlex = cs.flex;
  const prevContent = vertical ? cs.height : cs.width;
  sheetStyle[axis] = "auto";
  cs.flex = "none";
  if (vertical) cs.height = "auto";
  else cs.width = "auto";
  const poked = vertical ? element.offsetHeight : element.offsetWidth;
  const contentBox = vertical ? content.clientHeight : content.clientWidth;
  const contentScroll = vertical ? content.scrollHeight : content.scrollWidth;
  const natural = Math.max(poked, poked - contentBox + contentScroll);
  sheetStyle[axis] = prevSheet;
  cs.flex = prevFlex;
  if (vertical) cs.height = prevContent;
  else cs.width = prevContent;
  return natural;
};

export const containingExtent = (
  element: HTMLElement,
  vertical: boolean,
): number => {
  const op = element.offsetParent as HTMLElement | null;
  if (op && op !== document.body && op !== document.documentElement) {
    return vertical ? op.clientHeight : op.clientWidth;
  }
  return vertical ? window.innerHeight : window.innerWidth;
};

export const measureFitSize = (deps: FitMeasurementDeps): number => {
  const vertical = layoutAxis(deps.mode as TransformAxis) === "height";
  const natural = measureSheetNatural(
    deps.element,
    deps.scrollContainer,
    vertical,
  );
  const cap = deps.getMaxHeightCap();
  const capped = cap !== undefined ? Math.min(natural, cap) : natural;
  if (typeof window === "undefined") return capped;
  const viewport = containingExtent(deps.element, vertical);
  return viewport > 0 ? Math.min(capped, viewport) : capped;
};
