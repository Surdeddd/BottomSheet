import type { OverlayAnimation, OverlayEdge } from "./primitives/overlay-transforms";

export type OverlayCloseReason =
  | "escape"
  | "backdrop"
  | "swipe"
  | "back"
  | "programmatic"
  | "outside-pointer";

export type SwipeToCloseConfig = {
  enabled?: boolean;
  threshold?: number;
  velocityThreshold?: number;
};

export type OverlayMountTarget = HTMLElement | "body" | "parent";

export type OverlayPreset = "sheet" | "dialog" | "sidebar" | "toast";

type OverlayPresetConfig = {
  enterAnimation: OverlayAnimation;
  exitAnimation: OverlayAnimation;
  backdropOpacity: number;
  backdropFilter?: string;
  swipeToClose: boolean | SwipeToCloseConfig;
};

export const OVERLAY_PRESETS: Readonly<
  Record<OverlayPreset, Readonly<OverlayPresetConfig>>
> = Object.freeze({
  sheet: Object.freeze({
    enterAnimation: "slide" as const,
    exitAnimation: "slide" as const,
    backdropOpacity: 0.5,
    backdropFilter: undefined,
    swipeToClose: true,
  }),
  dialog: Object.freeze({
    enterAnimation: "scale" as const,
    exitAnimation: "scale" as const,
    backdropOpacity: 0.6,
    backdropFilter: "blur(8px)",
    swipeToClose: false,
  }),
  sidebar: Object.freeze({
    enterAnimation: "slide" as const,
    exitAnimation: "slide" as const,
    backdropOpacity: 0.4,
    backdropFilter: undefined,
    swipeToClose: true,
  }),
  toast: Object.freeze({
    enterAnimation: "fade" as const,
    exitAnimation: "fade" as const,
    backdropOpacity: 0,
    backdropFilter: undefined,
    swipeToClose: false,
  }),
});

export type OverlayUpdate = {
  backdropOpacity?: number;
  backdropFilter?: string | null;
  swipeToClose?: boolean | SwipeToCloseConfig;
  enterAnimation?: OverlayAnimation;
  exitAnimation?: OverlayAnimation;
  preset?: OverlayPreset;
  duration?: number;
  enterEasing?: string;
  exitEasing?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  closeOnOutsidePointer?: boolean;
  children?: HTMLElement | DocumentFragment | (() => HTMLElement | DocumentFragment) | null;
};

export type OverlayOptions = {
  element: HTMLElement;
  backdrop?: HTMLElement;
  edge?: OverlayEdge;
  initialOpen?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  focusTrap?: boolean;
  initialFocus?: string | HTMLElement;
  returnFocus?: HTMLElement | (() => HTMLElement | null);
  lockBodyScroll?: boolean;
  inertSiblings?: boolean;
  closeOnBack?: boolean;
  duration?: number;
  enterEasing?: string;
  exitEasing?: string;
  backdropOpacity?: number;
  backdropFilter?: string;
  swipeToClose?: boolean | SwipeToCloseConfig;
  enterAnimation?: OverlayAnimation;
  exitAnimation?: OverlayAnimation;
  mountTo?: OverlayMountTarget;
  peek?: number | string;
  closeOnOutsidePointer?: boolean;
  preset?: OverlayPreset;
  respectReducedMotion?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
};

export type OverlayState = {
  isOpen: boolean;
  isAnimating: boolean;
};

export type OverlayEventMap = {
  open: void;
  close: { reason: OverlayCloseReason };
  "before-open": void;
  "before-close": void;
};
