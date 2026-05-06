export { BottomSheetEngine } from "./BottomSheetEngine";

// ---- @internal animation primitives ----
// These are engine-internal; the barrel re-exports them for the rare
// consumer building a custom layout engine on top. They have no stability
// guarantee. v2 will move them off the public surface.

/** @internal */
export {
  tween,
  easeOutBack,
  easeOutCubic,
  prefersReducedMotion,
} from "./animation/animation";
/** @internal */
export { runSpring, DEFAULT_SPRING } from "./animation/spring";

// ---- snap-point math ----
// `resolveSnap` / `resolveSnapList` are kept public — consumers building
// custom layout engines reuse the size-string parsing. `findNearest` /
// `findById` / `allowedRange` are internal helpers.

export { resolveSnap, resolveSnapList } from "./primitives/snap-points";
/** @internal */
export {
  findNearest,
  findById,
  allowedRange,
} from "./primitives/snap-points";

// ---- @internal gesture wiring ----

/** @internal */
export { installGestures } from "./gestures";
/**
 * @deprecated Renamed to `installGestures`. Will be removed in v2.
 * @internal
 */
export { attachGestures } from "./gestures";

// ---- public utilities ----
// `installFocusTrap` / `lockBodyScroll` have legitimate "build your own modal"
// use cases — keep them on the public surface as supported helpers.

export { installFocusTrap } from "./lifecycle/focusTrap";
export { lockBodyScroll } from "./lifecycle/scrollLock";
export { sheetStack } from "./lifecycle/sheetStack";
export { createSheetManager } from "./lifecycle/sheetManager";

/**
 * @deprecated Import from `@surdeddd/bottom-sheet/overlay` instead. The barrel
 * re-export pulls OverlayEngine into bundles that may not need it; bundlers
 * with imperfect tree-shaking (older Webpack, esbuild without sideEffects-array
 * support) will keep the dead code. The subpath import is bundle-size-safe and
 * will be the only supported form in v2.
 */
export { OverlayEngine, Overlay, createOverlay } from "./overlay";
/** @deprecated Import from `@surdeddd/bottom-sheet/overlay` instead. */
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
/** @deprecated Import from `@surdeddd/bottom-sheet/overlay` instead. */
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
/** @internal — engine internals, exported for tests + advanced consumers building custom features. */
export type { ResolvedSnap } from "./primitives/snap-points";
/** @internal */
export type { Tween, TweenOptions } from "./animation/animation";
/** @internal */
export type {
  SpringConfig,
  SpringRunOptions,
  SpringHandle,
} from "./animation/spring";
/** @internal */
export type { StackEntry } from "./lifecycle/sheetStack";
export type { SheetConfig, SheetManager } from "./lifecycle/sheetManager";
