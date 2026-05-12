import type { SheetMode, SnapPoint } from "../types";

let probe: HTMLElement | null = null;
const PROBE_ATTR = "data-bs-probe";

const ensureProbe = (axis: "vertical" | "horizontal"): HTMLElement | null => {
  if (typeof document === "undefined") return null;
  if (!probe || !probe.isConnected) {

    const existing = document.querySelector<HTMLElement>(`[${PROBE_ATTR}]`);
    if (existing) {
      probe = existing;
    } else {
      probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.setAttribute(PROBE_ATTR, "");
      probe.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;contain:strict;left:0;top:0;width:0;height:0;";
      document.body.appendChild(probe);
    }
  }
  if (axis === "vertical") {
    probe.style.width = "0";
    probe.style.height = "";
  } else {
    probe.style.height = "0";
    probe.style.width = "";
  }
  return probe;
};

const isViewportAxisVertical = (mode: SheetMode) =>
  mode === "bottom" || mode === "top";

const viewportSize = (mode: SheetMode): number => {
  if (typeof window === "undefined") return 0;
  return isViewportAxisVertical(mode) ? window.innerHeight : window.innerWidth;
};

const PERCENT = /^(-?\d+(?:\.\d+)?)%$/;

export const resolveSnap = (
  point: SnapPoint | string,
  mode: SheetMode,
  measureFit?: () => number,
): number => {
  if (typeof point === "number") return Math.max(0, point);
  if (point === "full") return viewportSize(mode);
  if (point === "fit") return Math.max(0, measureFit?.() ?? 0);

  const pctMatch = point.match(PERCENT);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]!) / 100;
    return Math.max(0, viewportSize(mode) * pct);
  }

  const axis = isViewportAxisVertical(mode) ? "vertical" : "horizontal";
  const el = ensureProbe(axis);
  if (!el) return 0;
  if (axis === "vertical") {
    el.style.height = point;
    return Math.max(0, el.getBoundingClientRect().height);
  }
  el.style.width = point;
  return Math.max(0, el.getBoundingClientRect().width);
};

export const __resetCssLengthProbeForTests = (): void => {
  if (probe?.parentNode) probe.parentNode.removeChild(probe);
  probe = null;
};
