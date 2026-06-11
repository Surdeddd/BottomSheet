import { prefersReducedMotion } from "../animation/animation";

export type AnchorAnimationPreset =
  | "fade"
  | "scale"
  | "slide"
  | "pop"
  | "none";

export type AnchorAnimationSpec =
  | AnchorAnimationPreset
  | {
      preset?: AnchorAnimationPreset;
      enter?: Keyframe[];
      exit?: Keyframe[];
      duration?: number;
      easing?: string;
      respectReducedMotion?: boolean;
    };

export type AnchorTransitionHandle = {
  finished: Promise<void>;
  cancel: () => void;
};

const DEFAULT_DURATION = 200;
const DEFAULT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const PRESET_FRAMES: Record<
  Exclude<AnchorAnimationPreset, "none">,
  { enter: Keyframe[]; exit: Keyframe[] }
> = {
  fade: {
    enter: [{ opacity: 0 }, { opacity: 1 }],
    exit: [{ opacity: 1 }, { opacity: 0 }],
  },
  scale: {
    enter: [
      { opacity: 0, transform: "scale(0.85)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    exit: [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.85)" },
    ],
  },
  slide: {
    enter: [
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    exit: [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(10px)" },
    ],
  },
  pop: {
    enter: [
      { opacity: 0, transform: "scale(0.6)", offset: 0 },
      { opacity: 1, transform: "scale(1.06)", offset: 0.7 },
      { opacity: 1, transform: "scale(1)", offset: 1 },
    ],
    exit: [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.6)" },
    ],
  },
};

const INSTANT: AnchorTransitionHandle = {
  finished: Promise.resolve(),
  cancel: () => {},
};

export function resolveTransitionFrames(
  spec: AnchorAnimationSpec | undefined,
  phase: "enter" | "exit",
): { frames: Keyframe[] | null; duration: number; easing: string } {
  const fallback = { frames: null, duration: 0, easing: DEFAULT_EASING };
  if (spec === "none") return fallback;
  if (spec === undefined || typeof spec === "string") {
    const preset = PRESET_FRAMES[spec ?? "fade"];
    return {
      frames: preset[phase],
      duration: DEFAULT_DURATION,
      easing: DEFAULT_EASING,
    };
  }
  const custom = phase === "enter" ? spec.enter : spec.exit;
  if (custom) {
    return {
      frames: custom,
      duration: spec.duration ?? DEFAULT_DURATION,
      easing: spec.easing ?? DEFAULT_EASING,
    };
  }
  if (spec.preset === "none") return fallback;
  const preset = PRESET_FRAMES[spec.preset ?? "fade"];
  return {
    frames: preset[phase],
    duration: spec.duration ?? DEFAULT_DURATION,
    easing: spec.easing ?? DEFAULT_EASING,
  };
}

export function runAnchorTransition(
  el: HTMLElement,
  spec: AnchorAnimationSpec | undefined,
  phase: "enter" | "exit",
): AnchorTransitionHandle {
  const respectReduced =
    typeof spec === "object" ? spec.respectReducedMotion !== false : true;
  if (respectReduced && prefersReducedMotion()) return INSTANT;
  const { frames, duration, easing } = resolveTransitionFrames(spec, phase);
  if (!frames || duration <= 0) return INSTANT;
  if (typeof el.animate !== "function") return INSTANT;
  const animation = el.animate(frames, {
    duration,
    easing,
    fill: "both",
  });
  const finished = animation.finished
    .then(() => undefined)
    .catch(() => undefined);
  return {
    finished,
    cancel: () => {
      try {
        animation.cancel();
      } catch {
        return;
      }
    },
  };
}
