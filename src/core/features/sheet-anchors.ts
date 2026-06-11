import type { ScrimOverlayPosition, SheetEventMap, SheetMode } from "../types";
import { applyOverlayPosition } from "../primitives/overlay-position";
import {
  runAnchorTransition,
  type AnchorAnimationSpec,
  type AnchorTransitionHandle,
} from "../primitives/anchor-animations";

export type AnchorState = {
  activeId: string;
  size: number;
  progress: number;
};

export type AnchorPosition = ScrimOverlayPosition | "dock-bottom" | "dock-top";

export type AnchorOptions = {
  element: HTMLElement;
  position?: AnchorPosition;
  inset?: string;
  showOn?: string[] | ((state: AnchorState) => boolean);
  fadeRange?: [number, number];
  interactive?: boolean;
  animation?: AnchorAnimationSpec;
};

export type AnchorDeps = {
  mode: SheetMode;
  host: HTMLElement;
  getState: () => AnchorState;
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
  isDestroyed: () => boolean;
};

export type AnchorHandle = {
  wrapper: HTMLElement;
  detach: () => void;
  syncZ: (z: number) => void;
};

export function attachAnchor(deps: AnchorDeps, opts: AnchorOptions): AnchorHandle {
  const doc = deps.host.ownerDocument;
  const wrapper = doc.createElement("div");
  wrapper.className = "bs-anchor";
  const interactive = opts.interactive ?? true;
  const position = opts.position ?? "sheet-top-right";
  const isDock = position === "dock-bottom" || position === "dock-top";
  const ws = wrapper.style;
  ws.position = "fixed";
  if (isDock) {
    ws.left = "0";
    ws.right = "0";
    if (position === "dock-bottom") {
      ws.bottom = "0";
    } else {
      ws.top = "0";
    }
  } else {
    applyOverlayPosition(ws, deps.mode, position, opts.inset ?? "16px");
  }
  if (opts.fadeRange) {
    const [r0, r1] = opts.fadeRange;
    const span = Math.max(r1 - r0, 0.0001);
    ws.opacity = `clamp(0, calc((var(--bs-progress, 0) - ${r0}) / ${span}), 1)`;
  }
  wrapper.appendChild(opts.element);
  deps.host.appendChild(wrapper);

  let visible: boolean | null = null;
  let inFlight: AnchorTransitionHandle | null = null;

  const shouldShow = (state: AnchorState): boolean => {
    if (typeof opts.showOn === "function") return opts.showOn(state);
    if (Array.isArray(opts.showOn)) return opts.showOn.includes(state.activeId);
    return isDock || state.size > 0;
  };

  const applyVisibility = (next: boolean, animate: boolean): void => {
    if (next === visible) return;
    visible = next;
    inFlight?.cancel();
    inFlight = null;
    wrapper.style.pointerEvents = next && interactive ? "auto" : "none";
    if (next) {
      wrapper.style.visibility = "";
      if (animate) {
        inFlight = runAnchorTransition(opts.element, opts.animation, "enter");
      }
      return;
    }
    if (!animate) {
      wrapper.style.visibility = "hidden";
      return;
    }
    const handle = runAnchorTransition(opts.element, opts.animation, "exit");
    inFlight = handle;
    void handle.finished.then(() => {
      if (inFlight === handle && visible === false) {
        wrapper.style.visibility = "hidden";
      }
    });
  };

  const evaluate = (animate: boolean): void => {
    if (deps.isDestroyed()) return;
    applyVisibility(shouldShow(deps.getState()), animate);
  };

  const offs = [
    deps.on("snap", () => evaluate(true)),
    deps.on("open", () => evaluate(true)),
    deps.on("close", () => evaluate(true)),
  ];
  evaluate(false);

  return {
    wrapper,
    detach: () => {
      offs.forEach(off => off());
      inFlight?.cancel();
      inFlight = null;
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    },
    syncZ: (z: number) => {
      wrapper.style.zIndex = String(z);
    },
  };
}
