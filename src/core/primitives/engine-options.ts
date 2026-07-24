import type { DragFrom, EngineOptions, SheetMode } from "../types";
import type { ScrimControllerOptions } from "../controllers/scrim-controller";
import type { AnimationRunnerOptions } from "../controllers/animation-runner";
import type { LifecycleControllerOptions } from "../controllers/lifecycle-controller";
export const DEFAULT_FLICK_VELOCITY = 0.65;
export const DEFAULT_DRAG_THRESHOLD = 18;
export const DEFAULT_DURATION = 220;

export type ResolvedEngineOptions = {

  mode: SheetMode;

  flickVelocity: number;

  dragThreshold: number;

  dragFrom: DragFrom;

  dragFromContent: boolean;

  rubberBandEnabled: boolean;

  closeOnBack: boolean;

  persistent: boolean;

  disableClose: boolean;

  disableDrag: boolean;

  closeOnRouteChange: boolean;

  radius: string | number | undefined;

  maxHeight: string | number | undefined;

  initialAllowed: string[];

  initialId: string;

  scrim: ScrimControllerOptions;

  animation: AnimationRunnerOptions;

  lifecycle: LifecycleControllerOptions;
};

export type EngineOptionsExtras = {

  shouldApplyInertSiblings?: () => boolean;
};

export function resolveEngineOptions(
  opts: EngineOptions,
  extras?: EngineOptionsExtras,
): ResolvedEngineOptions {
  const initialAllowed = opts.allowed ?? opts.snapPoints.map(p => p.id);

  let initialId =
    opts.initial ??
    initialAllowed[0] ??
    opts.snapPoints[0]?.id ??
    "default";
  if (opts.persistKey) {
    const restored = readPersistedIdSafe(opts.persistKey);
    if (restored && initialAllowed.includes(restored)) {
      initialId = restored;
    }
  }

  return {
    mode: opts.mode ?? "bottom",
    flickVelocity: opts.flickVelocity ?? DEFAULT_FLICK_VELOCITY,
    dragThreshold: opts.dragThreshold ?? DEFAULT_DRAG_THRESHOLD,
    dragFrom: opts.dragFrom ?? (opts.handle ? "handle" : "sheet"),
    dragFromContent: opts.dragFromContent ?? true,
    rubberBandEnabled: opts.rubberBand ?? true,
    closeOnBack: opts.closeOnBack ?? false,
    persistent: opts.persistent ?? false,
    disableClose: opts.disableClose ?? false,
    disableDrag: opts.disableDrag ?? false,
    closeOnRouteChange: opts.closeOnRouteChange ?? false,
    radius: opts.radius,
    maxHeight: opts.maxHeight,
    initialAllowed,
    initialId,
    scrim: {
      scrimMode: opts.scrimMode,
      scrimColor: opts.scrimColor,
      scrimBlur: opts.scrimBlur,

      scrimInteractive:
        opts.scrimInteractive ??
        (opts.scrimTapToClose ? true : undefined),
      scrimTapToClose: opts.scrimTapToClose,
      scrimPreset: opts.scrimPreset,
      screenRange: opts.screenRange,
      backdropRange: opts.backdropRange,
    },
    animation: {
      animation: opts.animation,
      settleAnimation: opts.settleAnimation,
      duration: opts.duration,
      easing: opts.easing,
      spring: opts.spring,
      respectReducedMotion: opts.respectReducedMotion,
      viewTransitions: opts.viewTransitions,
    },
    lifecycle: {
      focusTrap: opts.focusTrap,
      initialFocus: opts.initialFocus,
      closeOnEscape: opts.closeOnEscape,
      lockBodyScroll: opts.lockBodyScroll,
      inertSiblings: opts.inertSiblings,

      shouldApplyInertSiblings: extras?.shouldApplyInertSiblings,
      returnFocus: opts.returnFocusTo,
    },
  };
}

const readPersistedIdSafe = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
