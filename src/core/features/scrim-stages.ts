import type { ScrimOverlayPosition, SheetEventMap, SheetMode } from "../types";
import { applyOverlayPosition } from "../primitives/overlay-position";
import {
  runAnchorTransition,
  type AnchorAnimationSpec,
  type AnchorTransitionHandle,
} from "../primitives/anchor-animations";

export type ScrimStageDef = {
  id?: string;
  for?: string | string[];
  forRange?: [number, number];
  element: HTMLElement;
  position?: ScrimOverlayPosition;
  inset?: string;
  interactive?: boolean;
  animation?: AnchorAnimationSpec;
};

export type ScrimStagesOptions = {
  stages: ScrimStageDef[];
  position?: ScrimOverlayPosition;
  inset?: string;
  interactive?: boolean;
  animation?: AnchorAnimationSpec;
};

export type ScrimStagesDeps = {
  mode: SheetMode;
  host: HTMLElement;
  getState: () => { activeId: string; size: number; progress: number };
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
  isDestroyed: () => boolean;
};

type StageEntry = {
  def: ScrimStageDef;
  wrapper: HTMLElement;
  inFlight: AnchorTransitionHandle | null;
};

const matchesId = (def: ScrimStageDef, activeId: string): boolean => {
  if (def.for === undefined) return false;
  return Array.isArray(def.for)
    ? def.for.includes(activeId)
    : def.for === activeId;
};

const matchesRange = (def: ScrimStageDef, progress: number): boolean => {
  if (!def.forRange) return false;
  const [from, to] = def.forRange;
  return progress >= from && progress <= to;
};

export function installScrimStages(
  deps: ScrimStagesDeps,
  opts: ScrimStagesOptions,
): () => void {
  const doc = deps.host.ownerDocument;
  const entries: StageEntry[] = opts.stages.map(def => {
    const wrapper = doc.createElement("div");
    wrapper.className = "bs-scrim-stage";
    const ws = wrapper.style;
    ws.position = "absolute";
    applyOverlayPosition(
      ws,
      deps.mode,
      def.position ?? opts.position ?? "center",
      def.inset ?? opts.inset ?? "16px",
    );
    ws.visibility = "hidden";
    ws.pointerEvents = "none";
    wrapper.appendChild(def.element);
    deps.host.appendChild(wrapper);
    return { def, wrapper, inFlight: null };
  });

  let active: StageEntry | null = null;

  const resolveActive = (): StageEntry | null => {
    const state = deps.getState();
    if (state.size === 0) {
      return entries.find(e => matchesId(e.def, state.activeId)) ?? null;
    }
    return (
      entries.find(e => matchesId(e.def, state.activeId)) ??
      entries.find(e => matchesRange(e.def, state.progress)) ??
      null
    );
  };

  const hide = (entry: StageEntry, animate: boolean): void => {
    entry.inFlight?.cancel();
    entry.wrapper.style.pointerEvents = "none";
    if (!animate) {
      entry.inFlight = null;
      entry.wrapper.style.visibility = "hidden";
      return;
    }
    const handle = runAnchorTransition(
      entry.def.element,
      entry.def.animation ?? opts.animation,
      "exit",
    );
    entry.inFlight = handle;
    void handle.finished.then(() => {
      if (entry.inFlight === handle && active !== entry) {
        entry.wrapper.style.visibility = "hidden";
      }
    });
  };

  const show = (entry: StageEntry, animate: boolean): void => {
    entry.inFlight?.cancel();
    entry.inFlight = null;
    entry.wrapper.style.visibility = "";
    entry.wrapper.style.pointerEvents =
      (entry.def.interactive ?? opts.interactive ?? false) ? "auto" : "none";
    if (animate) {
      entry.inFlight = runAnchorTransition(
        entry.def.element,
        entry.def.animation ?? opts.animation,
        "enter",
      );
    }
  };

  const update = (animate: boolean): void => {
    if (deps.isDestroyed()) return;
    const next = resolveActive();
    if (next === active) return;
    const prev = active;
    active = next;
    if (prev) hide(prev, animate);
    if (next) show(next, animate);
  };

  const offs = [
    deps.on("snap", () => update(true)),
    deps.on("open", () => update(true)),
    deps.on("close", () => update(true)),
  ];
  if (entries.some(e => e.def.forRange)) {
    offs.push(deps.on("progress", () => update(true)));
  }
  update(false);

  return () => {
    offs.forEach(off => off());
    for (const entry of entries) {
      entry.inFlight?.cancel();
      entry.inFlight = null;
      if (entry.wrapper.parentNode) {
        entry.wrapper.parentNode.removeChild(entry.wrapper);
      }
    }
    active = null;
  };
}
