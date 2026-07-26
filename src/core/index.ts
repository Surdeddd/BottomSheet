export { BottomSheetEngine } from "./BottomSheetEngine";
export { BottomSheetCore } from "./BottomSheetCore";
export { defaultEngineFeatures } from "./default-features";
export {
  routeFeature,
  persistFeature,
  autoCollapseFeature,
  contentSwipeFeature,
  visualViewportFeature,
} from "./features/engine-features";
export type {
  EngineFeature,
  EngineFeatureContext,
  EngineFeatureOptions,
  EngineFeatureStage,
} from "./types";

export { resolveSnap, resolveSnapList } from "./primitives/snap-points";
export { installGestures } from "./gestures";

export { installFocusTrap } from "./lifecycle/focus-trap";
export { lockBodyScroll } from "./lifecycle/scroll-lock";
export { sheetStack } from "./lifecycle/sheet-stack";
export { createSheetManager } from "./lifecycle/sheet-manager";

export type {
  SnapPoint,
  SnapPointDef,
  SnapId,
  SheetMode,
  SheetEventMap,
  CloseReason,
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
export type { StackEntry } from "./lifecycle/sheet-stack";
export type { SheetConfig, SheetManager } from "./lifecycle/sheet-manager";
export type {
  AnchorOptions,
  AnchorPosition,
  AnchorState,
  AnchorHandle,
} from "./features/sheet-anchors";
export type {
  ScrimStageDef,
  ScrimStagesOptions,
} from "./features/scrim-stages";
export type {
  AnchorAnimationSpec,
  AnchorAnimationPreset,
} from "./primitives/anchor-animations";
export { runAnchorTransition } from "./primitives/anchor-animations";
export {
  applyOverlayPosition,
  resolveSheetAnchoredStyle,
} from "./primitives/overlay-position";
