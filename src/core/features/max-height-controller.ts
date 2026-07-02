import { resolveSnap } from "../primitives/snap-points";
import { layoutAxis, type TransformAxis } from "../primitives/transform";
import type { SheetMode } from "../types";

export type MaxHeightControllerDeps = {
  element: HTMLElement;
  mode: SheetMode;
  getMaxAxisSize: () => number;
  setMaxAxisSize: (size: number) => void;
  recompute: () => void;
};

export type MaxHeightController = {
  setRadius: (r: string | number) => void;
  setMaxHeight: (h: string | number) => void;
  resolveCap: () => void;
  clampTo: () => void;
  getCap: () => number | undefined;
};

export function createMaxHeightController(
  deps: MaxHeightControllerDeps,
): MaxHeightController {
  let maxHeightCap: number | undefined;
  let maxHeightRaw: string | number | undefined;

  const resolveCap = (): void => {
    const raw = maxHeightRaw;
    if (raw === undefined) {
      maxHeightCap = undefined;
      return;
    }
    if (typeof raw === "number") {
      maxHeightCap = raw;
      return;
    }
    if (typeof window === "undefined") return;
    const measured = resolveSnap(raw, deps.mode);
    maxHeightCap = measured > 0 ? measured : undefined;
  };

  const clampTo = (): void => {
    if (maxHeightCap === undefined) return;
    if (deps.getMaxAxisSize() > maxHeightCap) {
      deps.setMaxAxisSize(maxHeightCap);
    }
  };

  return {
    setRadius(r) {
      deps.element.style.setProperty(
        "--bs-radius",
        typeof r === "number" ? `${r}px` : r,
      );
    },
    setMaxHeight(h) {
      const value = typeof h === "number" ? `${h}px` : h;
      const axis = layoutAxis(deps.mode as TransformAxis);
      deps.element.style.setProperty(
        axis === "height" ? "max-height" : "max-width",
        value,
      );
      maxHeightRaw = h;
      resolveCap();
      deps.recompute();
    },
    resolveCap,
    clampTo,
    getCap: () => maxHeightCap,
  };
}
