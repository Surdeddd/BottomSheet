import { extentOf } from "../primitives/css-length";
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
  const axis = vertical ? "height" : "width";
  const sheetStyle = element.style;
  if (!content) {
    const prev = sheetStyle[axis];
    sheetStyle[axis] = "auto";
    const poked = vertical ? element.offsetHeight : element.offsetWidth;
    sheetStyle[axis] = prev;
    return poked;
  }
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

export const containerOf = (element: HTMLElement): HTMLElement | null => {
  const op = element.offsetParent as HTMLElement | null;
  return op && op !== document.body && op !== document.documentElement
    ? op
    : null;
};

export const containingExtent = (
  element: HTMLElement,
  vertical: boolean,
): number => extentOf(containerOf(element), vertical);

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
