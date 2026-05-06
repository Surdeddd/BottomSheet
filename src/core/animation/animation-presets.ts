import { easeLinear, easeOutQuint } from "./animation";
import type { EngineOptions } from "../types";

const DEFAULT_DURATION = 220;

type AnimationOption = NonNullable<EngineOptions["animation"]>;

export type PresetResolution = {
  kind: "spring" | "tween";
  spring?: { stiffness?: number; damping?: number; mass?: number };
  duration?: number;
  easing?: (t: number) => number;
};

/**
 * Map an `animation` option to a base kind + curated default config. The two
 * raw kinds (`"spring"`, `"tween"`) pass through with empty config; the four
 * named presets prefill spring/duration/easing. Consumer-supplied overrides
 * still win — engine layers user values on top of preset defaults.
 */
export function resolveAnimationPreset(
  animation: AnimationOption | undefined,
): PresetResolution {
  switch (animation) {
    case "ios-spring":
      return {
        kind: "spring",
        spring: { stiffness: 300, damping: 30, mass: 1 },
      };
    case "material-bounce":
      return {
        kind: "spring",
        spring: { stiffness: 200, damping: 22, mass: 1 },
      };
    case "linear":
      return { kind: "tween", duration: DEFAULT_DURATION, easing: easeLinear };
    case "snappy":
      return { kind: "tween", duration: 180, easing: easeOutQuint };
    case "tween":
      return { kind: "tween" };
    case "spring":
    case undefined:
    default:
      return { kind: "spring" };
  }
}
