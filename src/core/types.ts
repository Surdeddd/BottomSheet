export type SnapPoint =
  | number
  | `${number}%`
  | "fit"
  | "content"
  | "full"
  | (string & {});

export type SnapPointDef<Id extends string = string> = {
  id: Id;
  size: SnapPoint;
};

export type SnapId<
  T extends
    | readonly SnapPointDef<string>[]
    | { snapPoints: readonly SnapPointDef<string>[] },
> = T extends { snapPoints: readonly SnapPointDef<infer U>[] }
  ? U
  : T extends readonly SnapPointDef<infer U>[]
    ? U
    : never;

export type SheetMode = import("./primitives/transform").TransformAxis;

export type ScrimPreset = "subtle" | "standard" | "monitoring" | "cinematic";

export type ScrimPresetConfig = {
  color: string;
  blur: string | undefined;
  range: [number, number];
  interactive: boolean;
};

export const SCRIM_PRESETS: Readonly<Record<ScrimPreset, ScrimPresetConfig>> =
  Object.freeze({
    subtle: {
      color: "rgba(0,0,0,0.2)",
      blur: undefined,
      range: [0.3, 1],
      interactive: false,
    },
    standard: {
      color: "rgba(0,0,0,0.4)",
      blur: undefined,
      range: [0, 1],
      interactive: false,
    },
    monitoring: {
      color: "rgba(15,15,20,0.55)",
      blur: "4px",
      range: [0, 1],
      interactive: false,
    },
    cinematic: {
      color: "rgba(0,0,0,0.7)",
      blur: "12px",
      range: [0, 1],
      interactive: false,
    },
  });

export type ScrimUpdate = {
  color?: string | null;
  blur?: string | null;
  interactive?: boolean;
  range?: [number, number];
  preset?: ScrimPreset;
  mode?: "full" | "above-sheet" | "off";
  tapToClose?: boolean;
  enabled?: boolean;
};

export type ScrimOverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "sheet-top-left"
  | "sheet-top-center"
  | "sheet-top-right";

export type ScrimOverlayOptions = {
  children: HTMLElement | DocumentFragment;
  position?: ScrimOverlayPosition;
  interactive?: boolean;
  inset?: string;
};

export type SheetEventMap = {
  "before-snap": {
    id: string;
    size: number;
    cancel: () => void;
    previousId: string;
  };
  "before-close": {
    reason: "programmatic" | "backdrop" | "escape" | "back";
    cancel: () => void;
  };
  snap: { id: string; size: number; progress: number };
  progress: { value: number; size: number };
  dragstart: { size: number };
  drag: { size: number; delta: number };
  dragend: { size: number; velocity: number };
  close: void;
  open: { id: string };
  opened: { id: string };
  closed: undefined;
};

export type CloseReason = "programmatic" | "backdrop" | "escape" | "back";

export type EngineOptions = {
  element: HTMLElement;
  handle?: HTMLElement;
  scrollContainer?: HTMLElement;
  backdrop?: HTMLElement;
  scrim?: HTMLElement;
  screenComponent?: HTMLElement;

  mode?: SheetMode;
  snapPoints: SnapPointDef[];
  allowed?: string[];
  initial?: string;

  duration?: number;
  easing?: (t: number) => number;
  respectReducedMotion?: boolean;

  flickVelocity?: number;
  dragThreshold?: number;
  rubberBand?: boolean;
  backdropRange?: [number, number];
  screenRange?: [number, number];
  scrimMode?: "full" | "above-sheet" | "off";
  scrimColor?: string;
  scrimBlur?: string;
  scrimInteractive?: boolean;
  scrimTapToClose?: boolean;
  scrimPreset?: ScrimPreset;

  animation?:
    | "spring"
    | "tween"
    | "ios-spring"
    | "material-bounce"
    | "linear"
    | "snappy";
  settleAnimation?: "waapi";
  spring?: { stiffness?: number; damping?: number; mass?: number };

  focusTrap?: boolean;
  initialFocus?: string | HTMLElement | false;
  closeOnEscape?: boolean;
  lockBodyScroll?: boolean;

  closeOnBack?: boolean;
  routedTo?: string;
  inertSiblings?: boolean;

  persistent?: boolean;
  disableClose?: boolean;
  disableDrag?: boolean;
  closeOnRouteChange?: boolean;
  radius?: string | number;
  maxHeight?: string | number;
  returnFocusTo?: HTMLElement | string | (() => HTMLElement | null);

  persistKey?: string;
  autoCollapseAfter?: number;
  linkedSheets?: BottomSheetEngineLike[];

  viewTransitions?: boolean;
  stackEffect?: boolean;

  features?: EngineFeature[];
};

import type { BottomSheetCore } from "./BottomSheetCore";

export type BottomSheetEngineLike = BottomSheetCore;

export type EngineFeatureStage = "attach" | "post";

export type EngineFeatureOptions = {
  routedTo?: string;
  closeOnBack: boolean;
  closeOnRouteChange: boolean;
  persistKey?: string;
  autoCollapseAfter?: number;
};

export type EngineFeatureContext = {
  element: HTMLElement;
  scrollContainer?: HTMLElement;
  sheetId: string;
  options: EngineFeatureOptions;
  isDestroyed: () => boolean;
  isDragging: () => boolean;
  isAnimating: () => boolean;
  isTopSheet: () => boolean;
  isVerticalAxis: () => boolean;
  getSize: () => number;
  getActiveId: () => string;
  getAllowedIds: () => string[];
  allowedIdsBySize: () => string[];
  getMaxAxisSize: () => number;
  resolveSnap: (id: string) => { id: string; size: number } | null;
  resolveActiveSnap: () => { id: string; size: number } | null;
  setSize: (size: number) => void;
  setMaxAxisSize: (size: number) => void;
  applySize: (size: number) => void;
  recomputeSnaps: () => void;
  newCycle: () => void;
  cancelInFlight: () => void;
  resyncAfterResize: () => void;
  snapTo: (id: string) => void;
  close: (reason?: CloseReason) => Promise<void>;
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
  addTeardown: (fn: (() => void) | null | undefined) => void;
};

export type EngineFeature = {
  name: string;
  stage?: EngineFeatureStage;
  install: (ctx: EngineFeatureContext) => (() => void) | void;
};

export type TeardownScope = {
  add: (fn: (() => void) | null | undefined) => void;
};

export type Plugin = {
  name: string;
  install: (
    engine: BottomSheetCore,
    scope: TeardownScope,
  ) => void | (() => void);
};

export type EngineState = {
  size: number;
  activeId: string;
  isDragging: boolean;
  isAnimating: boolean;
  progress: number;
};
