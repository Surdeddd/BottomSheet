import { devWarn } from "./dev-warn";
import type { SheetMode, SnapPoint } from "../types";

let probe: HTMLElement | null = null;
const rejected = new Set<string>();

const warnRejected = (value: string): void => {
  if (rejected.has(value)) return;
  rejected.add(value);
  devWarn(
    `[BottomSheet] snap size "${value}" is not a CSS length the browser accepts — it resolves to 0.`,
  );
};
const PROBE_ATTR = "data-bs-probe";

const ensureProbe = (
  axis: "vertical" | "horizontal",
  host?: HTMLElement | null,
): HTMLElement | null => {
  if (typeof document === "undefined") return null;
  if (!probe || !probe.isConnected) {
    probe = document.querySelector<HTMLElement>(`[${PROBE_ATTR}]`);
    if (!probe) {
      probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.setAttribute(PROBE_ATTR, "");
      probe.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;contain:strict;left:0;top:0;width:0;height:0;";
    }
  }
  const parent = host ?? document.body;
  if (probe.parentNode !== parent) parent.appendChild(probe);
  if (axis === "vertical") {
    probe.style.width = "0";
    probe.style.height = "";
  } else {
    probe.style.height = "0";
    probe.style.width = "";
  }
  return probe;
};

export const dropProbe = (host: HTMLElement): void => {
  if (probe?.parentNode === host) probe.remove();
};

const isViewportAxisVertical = (mode: SheetMode) =>
  mode === "bottom" || mode === "top";

export const extentOf = (
  host: HTMLElement | null | undefined,
  vertical: boolean,
): number => {
  if (host) return vertical ? host.clientHeight : host.clientWidth;
  if (typeof window === "undefined") return 0;
  return vertical ? window.innerHeight : window.innerWidth;
};

const viewportSize = (mode: SheetMode, host?: HTMLElement | null): number =>
  extentOf(host, isViewportAxisVertical(mode));

const PERCENT = /^(-?\d+(?:\.\d+)?)%$/;

export const resolveSnap = (
  point: SnapPoint | string,
  mode: SheetMode,
  measureFit?: () => number,
  host?: HTMLElement | null,
): number => {
  if (typeof point === "number") return Math.max(0, point);
  if (point === "full") return viewportSize(mode, host);
  if (point === "fit" || point === "content") {
    return Math.max(0, measureFit?.() ?? 0);
  }

  const pctMatch = point.match(PERCENT);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]!) / 100;
    return Math.max(0, viewportSize(mode, host) * pct);
  }

  const axis = isViewportAxisVertical(mode) ? "vertical" : "horizontal";
  const el = ensureProbe(axis, host);
  if (!el) return 0;
  if (axis === "vertical") {
    el.style.height = point;
    if (el.style.height === "") warnRejected(point);
    return Math.max(0, el.getBoundingClientRect().height);
  }
  el.style.width = point;
  if (el.style.width === "") warnRejected(point);
  return Math.max(0, el.getBoundingClientRect().width);
};

export const __resetCssLengthProbeForTests = (): void => {
  if (probe?.parentNode) probe.parentNode.removeChild(probe);
  probe = null;
  rejected.clear();
};
