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

// The @deprecated tags live on the declarations themselves, not here: JSDoc on
// an export specifier is dropped when the .d.ts is rolled up, and re-binding
// through `const` aliases defeats tree-shaking (measured: +0.5 KB gzip on the
// core entry, over budget). Plain re-exports carry the tag through both.
export {
  tween,
  easeOutBack,
  easeOutCubic,
  prefersReducedMotion,
} from "./animation/animation";
export { runSpring, DEFAULT_SPRING } from "./animation/spring";
export {
  findNearest,
  findById,
  allowedRange,
} from "./primitives/snap-points";
export { resolveSnap, resolveSnapList } from "./primitives/snap-points";
export { installGestures, attachGestures } from "./gestures";

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
export type { StackEntry } from "./lifecycle/sheetStack";
export type { SheetConfig, SheetManager } from "./lifecycle/sheetManager";
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
