export { BottomSheetEngine } from "./BottomSheetEngine";

export {
  tween,
  easeOutBack,
  easeOutCubic,
  prefersReducedMotion,
} from "./animation/animation";
export { runSpring, DEFAULT_SPRING } from "./animation/spring";

export { resolveSnap, resolveSnapList } from "./primitives/snap-points";
export {
  findNearest,
  findById,
  allowedRange,
} from "./primitives/snap-points";

export { installGestures } from "./gestures";
export { attachGestures } from "./gestures";

export { installFocusTrap } from "./lifecycle/focusTrap";
export { lockBodyScroll } from "./lifecycle/scrollLock";
export { sheetStack } from "./lifecycle/sheetStack";
export { createSheetManager } from "./lifecycle/sheetManager";

export { OverlayEngine, Overlay, createOverlay } from "./overlay";
export type {
  OverlayOptions,
  OverlayState,
  OverlayEdge,
  OverlayEventMap,
  OverlayPreset,
  OverlayUpdate,
  OverlayAnimation,
  OverlayCloseReason,
  SwipeToCloseConfig,
  OverlayMountTarget,
} from "./overlay";
export { OVERLAY_PRESETS } from "./overlay";

export type {
  SnapPoint,
  SnapPointDef,
  SnapId,
  SheetMode,
  SheetEventMap,
  EngineOptions,
  EngineState,
  ScrimPreset,
  ScrimPresetConfig,
  ScrimUpdate,
  ScrimOverlayOptions,
  ScrimOverlayPosition,
} from "./types";
export { SCRIM_PRESETS } from "./types";
export type { Plugin, TeardownScope } from "./types";
export type { ResolvedSnap } from "./primitives/snap-points";
export type { Tween, TweenOptions } from "./animation/animation";
export type {
  SpringConfig,
  SpringRunOptions,
  SpringHandle,
} from "./animation/spring";
export type { StackEntry } from "./lifecycle/sheetStack";
export type { SheetConfig, SheetManager } from "./lifecycle/sheetManager";
