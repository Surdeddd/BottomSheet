export type SnapPoint =
  | number
  | `${number}%`
  | "fit"
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
  snap: { id: string; size: number };
  progress: { value: number; size: number };
  dragstart: { size: number };
  drag: { size: number; delta: number };
  dragend: { size: number; velocity: number };
  close: void;
  open: { id: string };
};

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
  spring?: { stiffness?: number; damping?: number; mass?: number };

  focusTrap?: boolean;
  initialFocus?: string | HTMLElement;
  closeOnEscape?: boolean;
  lockBodyScroll?: boolean;

  closeOnBack?: boolean;
  routedTo?: string;
  inertSiblings?: boolean;

  persistKey?: string;
  autoCollapseAfter?: number;
  linkedSheets?: BottomSheetEngineLike[];

  viewTransitions?: boolean;
};

import type { BottomSheetEngine } from "./BottomSheetEngine";

export type BottomSheetEngineLike = BottomSheetEngine;

export type TeardownScope = {
  add: (fn: (() => void) | null | undefined) => void;
};

export type Plugin = {
  name: string;
  install: (
    engine: BottomSheetEngine,
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
