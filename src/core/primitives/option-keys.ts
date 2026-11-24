import type { EngineOptions } from "../types";

export const ENGINE_OPTION_KEYS = [
  "mode",
  "snapPoints",
  "allowed",
  "initial",
  "duration",
  "easing",
  "respectReducedMotion",
  "flickVelocity",
  "dragThreshold",
  "dragFrom",
  "dragFromContent",
  "fitContentToSnap",
  "rubberBand",
  "backdropRange",
  "backdropOpacity",
  "backdropColor",
  "screenRange",
  "scrimMode",
  "scrimColor",
  "scrimBlur",
  "scrimInteractive",
  "scrimTapToClose",
  "scrimPreset",
  "animation",
  "settleAnimation",
  "spring",
  "focusTrap",
  "initialFocus",
  "closeOnEscape",
  "lockBodyScroll",
  "closeOnBack",
  "routedTo",
  "inertSiblings",
  "persistent",
  "disableClose",
  "disableDrag",
  "closeOnRouteChange",
  "radius",
  "maxHeight",
  "bounds",
  "returnFocusTo",
  "persistKey",
  "autoCollapseAfter",
  "linkedSheets",
  "viewTransitions",
  "stackEffect",
  "features",
] as const satisfies ReadonlyArray<keyof EngineOptions>;

export type EngineConfig = Pick<
  EngineOptions,
  (typeof ENGINE_OPTION_KEYS)[number]
>;

export const pickEngineOptions = (
  source: Record<string, unknown>,
): Partial<EngineConfig> => {
  const out: Record<string, unknown> = {};
  for (const key of ENGINE_OPTION_KEYS) {
    const value = source[key];
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<EngineConfig>;
};
