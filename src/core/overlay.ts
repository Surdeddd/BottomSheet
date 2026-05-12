import { sheetStack } from "./lifecycle/sheetStack";
import { CLOSED_TRANSFORM, type TransformAxis } from "./primitives/transform";
import { resolveSnap } from "./primitives/cssLength";
import { nextInstanceId } from "./primitives/instance-id";
import { createEventBus, type EventBus } from "./primitives/event-bus";
import { LifecycleController } from "./controllers/lifecycle-controller";

export type OverlayEdge = TransformAxis;

export type OverlayAnimation = "slide" | "fade" | "scale";

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

type Listener<K extends keyof OverlayEventMap> = (
  payload: OverlayEventMap[K],
) => void;

const closedTransform = (edge: OverlayEdge): string => CLOSED_TRANSFORM[edge];

const closedTransformFor = (
  edge: OverlayEdge,
  animation: OverlayAnimation,
  peekPx?: number,
): string => {
  switch (animation) {
    case "fade":
      return "translate3d(0, 0, 0)";
    case "scale":
      return "translate3d(0, 0, 0) scale(0.94)";
    case "slide":
    default:
      if (peekPx !== undefined && edge === "bottom") {
        return `translate3d(0, calc(100% - ${peekPx}px), 0)`;
      }
      return closedTransform(edge);
  }
};

const openTransformFor = (animation: OverlayAnimation): string =>
  animation === "scale"
    ? "translate3d(0, 0, 0) scale(1)"
    : "translate3d(0, 0, 0)";

export class OverlayEngine {
  private id = nextInstanceId("ovl");
  private element: HTMLElement;
  private backdrop?: HTMLElement;
  private edge: OverlayEdge;
  private closeOnEscape: boolean;
  private closeOnBackdropEnabled: boolean;
  private focusTrapEnabled: boolean;
  private initialFocus?: string | HTMLElement;
  private bodyScrollLockEnabled: boolean;
  private inertSiblingsEnabled: boolean;
  private closeOnBackEnabled: boolean;
  private duration: number;
  private enterEasing: string;
  private exitEasing: string;
  private backdropOpacity: number;
  private backdropFilter?: string;
  private swipeToCloseEnabled!: boolean;
  private swipeThreshold!: number;
  private swipeVelocityThreshold!: number;
  private enterAnimation: OverlayAnimation;
  private exitAnimation: OverlayAnimation;
  private mountTarget?: OverlayMountTarget;
  private originalParent: ParentNode | null = null;
  private originalNextSibling: Node | null = null;
  private mounted = false;
  private peekRaw?: number | string;
  private peekPx?: number;
  private closeOnOutsidePointerEnabled: boolean;
  private detachOutsidePointer: (() => void) | null = null;
  private detachSwipe: (() => void) | null = null;
  private onOpenCb?: () => void;
  private onCloseCb?: () => void;

  private isOpen_ = false;
  private isAnimating_ = false;
  private destroyed = false;
  private hasInjectedChildren = false;
  private cycleNonce = 0;
  private bus: EventBus<OverlayEventMap> = createEventBus<OverlayEventMap>();
  private detachEscape: (() => void) | null = null;
  private detachBackdrop: (() => void) | null = null;
  private detachHardwareBack: (() => void) | null = null;
  private releaseStackEntry: (() => void) | null = null;
  private lifecycle: LifecycleController;

  constructor(opts: OverlayOptions) {
    this.element = opts.element;
    this.backdrop = opts.backdrop;
    this.edge = opts.edge ?? "bottom";
    this.closeOnEscape = opts.closeOnEscape ?? true;
    this.closeOnBackdropEnabled = opts.closeOnBackdrop ?? true;
    this.focusTrapEnabled = opts.focusTrap ?? true;
    this.initialFocus = opts.initialFocus;
    this.bodyScrollLockEnabled = opts.lockBodyScroll ?? true;
    this.inertSiblingsEnabled = opts.inertSiblings ?? false;
    this.closeOnBackEnabled = opts.closeOnBack ?? false;
    this.duration = opts.duration ?? 320;
    this.enterEasing = opts.enterEasing ?? "cubic-bezier(0.29, 1.24, 0.84, 0.99)";
    this.exitEasing = opts.exitEasing ?? "cubic-bezier(0.4, 0, 1, 1)";

    const preset = opts.preset ? OVERLAY_PRESETS[opts.preset] : undefined;
    this.backdropOpacity =
      opts.backdropOpacity ?? preset?.backdropOpacity ?? 1;
    this.backdropFilter =
      opts.backdropFilter ?? preset?.backdropFilter ?? undefined;

    const swipeRaw =
      opts.swipeToClose !== undefined ? opts.swipeToClose : preset?.swipeToClose;
    this.assignSwipeFromConfig(swipeRaw);

    this.enterAnimation =
      opts.enterAnimation ?? preset?.enterAnimation ?? "slide";
    this.exitAnimation =
      opts.exitAnimation ?? preset?.exitAnimation ?? this.enterAnimation;
    this.mountTarget = opts.mountTo;
    this.peekRaw = opts.peek;
    this.closeOnOutsidePointerEnabled = opts.closeOnOutsidePointer ?? false;
    this.onOpenCb = opts.onOpen;
    this.onCloseCb = opts.onClose;

    if (this.peekRaw !== undefined && this.edge !== "bottom") {
      // eslint-disable-next-line no-console
      console.warn(
        "[OverlayEngine] `peek` is only supported on edge: 'bottom' — ignoring.",
      );
      this.peekRaw = undefined;
    }
    if (this.peekRaw !== undefined) {
      this.peekPx = this.resolvePeekPx(this.peekRaw);
    }

    this.lifecycle = new LifecycleController(
      {
        element: this.element,
        close: () => this.close("escape"),
      },
      {
        focusTrap: this.focusTrapEnabled,
        initialFocus: this.initialFocus,
        closeOnEscape: this.closeOnEscape,
        lockBodyScroll: this.bodyScrollLockEnabled,
        inertSiblings: this.inertSiblingsEnabled,
        shouldApplyInertSiblings: () => {
          const bodyChildren = Array.from(document.body.children) as HTMLElement[];
          return bodyChildren.some(
            c => c === this.element || c.contains(this.element),
          );
        },
        returnFocus: opts.returnFocus,
      },
    );

    this.applyClosedStyles();
    this.registerInStack();
    if (opts.initialOpen) void this.open();
  }

  get state(): OverlayState {
    return { isOpen: this.isOpen_, isAnimating: this.isAnimating_ };
  }

  on<K extends keyof OverlayEventMap>(event: K, fn: Listener<K>): () => void {
    return this.bus.on(event, fn);
  }

  open(): Promise<void> {
    if (this.destroyed || this.isOpen_) return Promise.resolve();
    this.maybeMount();
    this.emit("before-open", undefined);
    this.isOpen_ = true;
    this.isAnimating_ = true;
    this.element.removeAttribute("hidden");
    this.element.setAttribute("data-state", "entering");
    if (this.focusTrapEnabled) {
      this.element.setAttribute("aria-modal", "true");
    }

    const transitionStr = `transform ${this.duration}ms ${this.enterEasing}, opacity ${this.duration}ms ease-out`;
    this.element.style.transition = transitionStr;
    if (this.backdrop) {
      this.backdrop.style.transition = `opacity ${this.duration}ms ease-out`;
    }

    const cycle = ++this.cycleNonce;
    return new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        if (this.destroyed || cycle !== this.cycleNonce) return resolve();
        requestAnimationFrame(() => {
          if (this.destroyed || cycle !== this.cycleNonce) return resolve();
          this.element.style.transform = openTransformFor(this.enterAnimation);
          this.element.style.opacity = "1";
          if (this.backdrop) {
            this.backdrop.style.opacity = String(this.backdropOpacity);
            this.backdrop.style.pointerEvents = "auto";
            if (this.backdropFilter) {
              this.backdrop.style.backdropFilter = this.backdropFilter;
              (this.backdrop.style as CSSStyleDeclaration & {
                webkitBackdropFilter?: string;
              }).webkitBackdropFilter = this.backdropFilter;
            }
          }
          try {
            this.installInteractiveListeners();
          } catch (err) {
            this.releaseInteractiveListeners();
            this.isOpen_ = false;
            this.isAnimating_ = false;
            this.element.style.transform = closedTransformFor(
              this.edge,
              this.enterAnimation,
              this.peekPx,
            );
            this.element.style.opacity = "0";
            if (this.backdrop) {
              this.backdrop.style.opacity = "0";
              this.backdrop.style.pointerEvents = "none";
              if (this.backdropFilter) {
                this.backdrop.style.backdropFilter = "";
                (this.backdrop.style as CSSStyleDeclaration & {
                  webkitBackdropFilter?: string;
                }).webkitBackdropFilter = "";
              }
            }
            this.element.setAttribute("data-state", "closed");
            this.element.setAttribute("hidden", "");
            if (this.focusTrapEnabled) {
              this.element.removeAttribute("aria-modal");
            }
            queueMicrotask(() => {
              throw err;
            });
            return resolve();
          }
          this.awaitTransition(cycle).then(() => {
            if (this.destroyed || cycle !== this.cycleNonce) return resolve();
            this.isAnimating_ = false;
            this.element.setAttribute("data-state", "open");
            this.emit("open", undefined);
            this.onOpenCb?.();
            resolve();
          });
        });
      });
    });
  }

  close(reason: OverlayCloseReason = "programmatic"): Promise<void> {
    if (this.destroyed || !this.isOpen_) return Promise.resolve();
    this.emit("before-close", undefined);
    this.isOpen_ = false;
    this.isAnimating_ = true;
    this.element.setAttribute("data-state", "exiting");

    const transitionStr = `transform ${this.duration}ms ${this.exitEasing}, opacity ${this.duration}ms ease-in`;
    this.element.style.transition = transitionStr;
    if (this.backdrop) {
      this.backdrop.style.transition = `opacity ${this.duration}ms ease-in`;
    }

    const cycle = ++this.cycleNonce;
    return new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        if (this.destroyed || cycle !== this.cycleNonce) return resolve();
        this.element.style.transform = closedTransformFor(
          this.edge,
          this.exitAnimation,
          this.peekPx,
        );
        this.element.style.opacity = "0";
        if (this.backdrop) {
          this.backdrop.style.opacity = "0";
          this.backdrop.style.pointerEvents = "none";
          if (this.backdropFilter) {
            this.backdrop.style.backdropFilter = "";
            (this.backdrop.style as CSSStyleDeclaration & {
              webkitBackdropFilter?: string;
            }).webkitBackdropFilter = "";
          }
        }
        this.releaseInteractiveListeners();
        this.awaitTransition(cycle).then(() => {
          if (this.destroyed || cycle !== this.cycleNonce) return resolve();
          this.isAnimating_ = false;
          if (this.peekPx === undefined) {
            this.element.setAttribute("hidden", "");
          }
          this.element.setAttribute("data-state", "closed");
          if (this.focusTrapEnabled) {
            this.element.removeAttribute("aria-modal");
          }
          this.emit("close", { reason });
          this.onCloseCb?.();
          resolve();
        });
      });
    });
  }

  toggle(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return this.isOpen_ ? this.close() : this.open();
  }

  destroy(): void {
    this.destroyed = true;
    this.cycleNonce++;
    this.bus.clear();
    this.releaseInteractiveListeners();
    this.releaseStackEntry?.();
    this.releaseStackEntry = null;
    this.restoreMount();
  }

  setBackdropOpacity(opacity: number): void {
    if (this.destroyed) return;
    this.backdropOpacity = opacity;
    if (this.isOpen_ && this.backdrop) {
      this.backdrop.style.opacity = String(opacity);
    }
  }

  setBackdropFilter(filter: string | undefined): void {
    if (this.destroyed) return;
    this.backdropFilter = filter;
    if (!this.isOpen_ || !this.backdrop) return;
    const style = this.backdrop.style as CSSStyleDeclaration & {
      webkitBackdropFilter?: string;
    };
    if (filter) {
      this.backdrop.style.backdropFilter = filter;
      style.webkitBackdropFilter = filter;
    } else {
      this.backdrop.style.backdropFilter = "";
      style.webkitBackdropFilter = "";
    }
  }

  setSwipeToClose(config: boolean | SwipeToCloseConfig): void {
    if (this.destroyed) return;
    const wasEnabled = this.swipeToCloseEnabled;
    this.assignSwipeFromConfig(config);
    if (!this.isOpen_) return;
    if (this.swipeToCloseEnabled && !this.detachSwipe) {
      this.detachSwipe = this.installSwipeToClose();
    } else if (!this.swipeToCloseEnabled && wasEnabled && this.detachSwipe) {
      this.detachSwipe();
      this.detachSwipe = null;
    }
  }

  setEnterAnimation(animation: OverlayAnimation): void {
    if (this.destroyed) return;
    this.enterAnimation = animation;
  }

  setExitAnimation(animation: OverlayAnimation): void {
    if (this.destroyed) return;
    this.exitAnimation = animation;
  }

  setReturnFocus(
    target: HTMLElement | (() => HTMLElement | null) | undefined,
  ): void {
    if (this.destroyed) return;
    this.lifecycle.setReturnFocus(target);
  }

  setOverlay(opts: OverlayUpdate): void {
    if (this.destroyed) return;
    const preset = opts.preset ? OVERLAY_PRESETS[opts.preset] : undefined;
    const merged: {
      backdropOpacity?: number;
      backdropFilter?: string | null;
      swipeToClose?: boolean | SwipeToCloseConfig;
      enterAnimation?: OverlayAnimation;
      exitAnimation?: OverlayAnimation;
    } = preset
      ? {
          backdropOpacity: preset.backdropOpacity,
          backdropFilter:
            preset.backdropFilter === undefined ? null : preset.backdropFilter,
          swipeToClose: preset.swipeToClose,
          enterAnimation: preset.enterAnimation,
          exitAnimation: preset.exitAnimation,
        }
      : {};
    if (opts.backdropOpacity !== undefined) {
      merged.backdropOpacity = opts.backdropOpacity;
    }
    if (opts.backdropFilter !== undefined) {
      merged.backdropFilter = opts.backdropFilter;
    }
    if (opts.swipeToClose !== undefined) {
      merged.swipeToClose = opts.swipeToClose;
    }
    if (opts.enterAnimation !== undefined) {
      merged.enterAnimation = opts.enterAnimation;
    }
    if (opts.exitAnimation !== undefined) {
      merged.exitAnimation = opts.exitAnimation;
    }

    if (merged.enterAnimation !== undefined) {
      this.enterAnimation = merged.enterAnimation;
    }
    if (merged.exitAnimation !== undefined) {
      this.exitAnimation = merged.exitAnimation;
    }
    if (merged.swipeToClose !== undefined) {
      this.setSwipeToClose(merged.swipeToClose);
    }

    if (merged.backdropOpacity !== undefined) {
      this.backdropOpacity = merged.backdropOpacity;
    }
    if (merged.backdropFilter !== undefined) {
      this.backdropFilter =
        merged.backdropFilter === null ? undefined : merged.backdropFilter;
    }
    if (this.isOpen_ && this.backdrop) {
      if (merged.backdropOpacity !== undefined) {
        this.backdrop.style.opacity = String(this.backdropOpacity);
      }
      if (merged.backdropFilter !== undefined) {
        const style = this.backdrop.style as CSSStyleDeclaration & {
          webkitBackdropFilter?: string;
        };
        if (this.backdropFilter) {
          this.backdrop.style.backdropFilter = this.backdropFilter;
          style.webkitBackdropFilter = this.backdropFilter;
        } else {
          this.backdrop.style.backdropFilter = "";
          style.webkitBackdropFilter = "";
        }
      }
    }

    if (opts.children !== undefined) {
      if (opts.children === null) {
        this.clearOverlayChildren();
      } else {
        this.setOverlayChildren(opts.children);
      }
    }
  }

  setOverlayChildren(
    children: HTMLElement | DocumentFragment | (() => HTMLElement | DocumentFragment),
  ): void {
    if (this.destroyed) return;
    const node = typeof children === "function" ? children() : children;
    this.element.replaceChildren(node);
    this.hasInjectedChildren = true;
  }

  clearOverlayChildren(): void {
    if (this.destroyed || !this.hasInjectedChildren) return;
    this.element.replaceChildren();
    this.hasInjectedChildren = false;
  }

  private assignSwipeFromConfig(
    swipe: boolean | SwipeToCloseConfig | undefined,
  ): void {
    if (typeof swipe === "object" && swipe !== null) {
      this.swipeToCloseEnabled = swipe.enabled ?? true;
      this.swipeThreshold = swipe.threshold ?? 0.3;
      this.swipeVelocityThreshold = swipe.velocityThreshold ?? 0.5;
    } else {
      this.swipeToCloseEnabled = swipe ?? false;
      this.swipeThreshold = 0.3;
      this.swipeVelocityThreshold = 0.5;
    }
  }

  private emit<K extends keyof OverlayEventMap>(
    event: K,
    payload: OverlayEventMap[K],
  ): void {
    this.bus.emit(event, payload);
  }

  private resolvePeekPx(raw: number | string): number {
    if (typeof raw === "number") return Math.max(0, raw);
    try {
      return Math.max(0, resolveSnap(raw, "bottom"));
    } catch {
      return 0;
    }
  }

  private maybeMount(): void {
    if (this.mounted || !this.mountTarget || this.mountTarget === "parent") {
      this.mounted = true;
      return;
    }
    const target =
      this.mountTarget === "body" ? document.body : this.mountTarget;
    if (!target) {
      this.mounted = true;
      return;
    }
    this.originalParent = this.element.parentNode;
    this.originalNextSibling = this.element.nextSibling;
    target.appendChild(this.element);
    this.mounted = true;
  }

  private restoreMount(): void {
    if (!this.originalParent) return;
    try {
      if (
        this.originalNextSibling &&
        this.originalNextSibling.parentNode === this.originalParent
      ) {
        this.originalParent.insertBefore(this.element, this.originalNextSibling);
      } else {
        this.originalParent.appendChild(this.element);
      }
    } catch {
    }
    this.originalParent = null;
    this.originalNextSibling = null;
  }

  private applyClosedStyles(): void {
    this.element.style.willChange = "transform, opacity";
    this.element.style.transform = closedTransformFor(
      this.edge,
      this.enterAnimation,
      this.peekPx,
    );
    this.element.style.opacity = this.peekPx !== undefined ? "1" : "0";
    if (this.peekPx === undefined) {
      this.element.setAttribute("hidden", "");
    }
    this.element.setAttribute("data-state", "closed");
    if (this.backdrop) {
      this.backdrop.style.opacity = "0";
      this.backdrop.style.pointerEvents = "none";
      this.backdrop.style.willChange = "opacity";
    }
  }

  private awaitTransition(cycle: number): Promise<void> {
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.element.removeEventListener("transitionend", onEnd);
        clearTimeout(timer);
        resolve();
      };
      const onEnd = (e: TransitionEvent) => {
        if (cycle !== this.cycleNonce) {
          finish();
          return;
        }
        if (e.propertyName === "transform") finish();
      };
      this.element.addEventListener("transitionend", onEnd);
      const timer = window.setTimeout(finish, this.duration + 50);
    });
  }

  private installInteractiveListeners(): void {
    this.lifecycle.install();
    if (this.swipeToCloseEnabled && !this.detachSwipe) {
      this.detachSwipe = this.installSwipeToClose();
    }
    if (this.closeOnEscape && !this.detachEscape) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape" && this.isOpen_) void this.close("escape");
      };
      document.addEventListener("keydown", handler);
      this.detachEscape = () => document.removeEventListener("keydown", handler);
    }
    if (
      this.closeOnBackdropEnabled &&
      this.backdrop &&
      !this.detachBackdrop
    ) {
      const handler = () => void this.close("backdrop");
      this.backdrop.addEventListener("click", handler);
      this.detachBackdrop = () =>
        this.backdrop?.removeEventListener("click", handler);
    }
    if (
      this.closeOnBackEnabled &&
      typeof window !== "undefined" &&
      !this.detachHardwareBack
    ) {
      try {
        history.pushState({ __bsOverlay: this.id }, "");
      } catch {
      }
      const onPop = () => {
        if (this.isOpen_) void this.close("back");
      };
      window.addEventListener("popstate", onPop);
      this.detachHardwareBack = () =>
        window.removeEventListener("popstate", onPop);
    }
    if (this.closeOnOutsidePointerEnabled && !this.detachOutsidePointer) {
      const handler = (e: PointerEvent) => {
        if (!this.isOpen_) return;
        const target = e.target as Node | null;
        if (!target) return;
        if (this.element.contains(target)) return;
        if (this.backdrop && this.backdrop.contains(target)) return;
        void this.close("outside-pointer");
      };
      document.addEventListener("pointerdown", handler, true);
      this.detachOutsidePointer = () =>
        document.removeEventListener("pointerdown", handler, true);
    }
  }

  private releaseInteractiveListeners(): void {
    this.detachEscape?.();
    this.detachEscape = null;
    this.detachBackdrop?.();
    this.detachBackdrop = null;
    this.detachHardwareBack?.();
    this.detachHardwareBack = null;
    this.detachSwipe?.();
    this.detachSwipe = null;
    this.detachOutsidePointer?.();
    this.detachOutsidePointer = null;
    this.lifecycle.release();
  }

  private installSwipeToClose(): () => void {
    const el = this.element;
    const edge = this.edge;
    const isVertical = edge === "bottom" || edge === "top";
    const sign = edge === "bottom" || edge === "right" ? 1 : -1;
    const threshold = this.swipeThreshold;
    const velocityThreshold = this.swipeVelocityThreshold;
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let dragging = false;
    let pointerId: number | null = null;
    const onDown = (e: PointerEvent): void => {
      if (e.button !== undefined && e.button !== 0) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startT = performance.now();
      dragging = true;
      el.style.transition = "none";
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
      }
    };
    const onMove = (e: PointerEvent): void => {
      if (!dragging || e.pointerId !== pointerId) return;
      const delta = isVertical ? e.clientY - startY : e.clientX - startX;
      const offset = Math.max(0, sign * delta);
      el.style.transform = isVertical
        ? `translate3d(0, ${sign * offset}px, 0)`
        : `translate3d(${sign * offset}px, 0, 0)`;
    };
    const finish = (e: PointerEvent): void => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      const dt = performance.now() - startT || 1;
      const delta = isVertical ? e.clientY - startY : e.clientX - startX;
      const offset = Math.max(0, sign * delta);
      const velocity = (sign * delta) / dt;
      const size = isVertical ? el.offsetHeight : el.offsetWidth;
      const past = offset > size * threshold || velocity > velocityThreshold;
      el.style.transition = `transform ${this.duration}ms ${this.exitEasing}`;
      if (past) {
        void this.close("swipe");
      } else {
        el.style.transform = openTransformFor(this.enterAnimation);
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", finish);
    };
  }

  private registerInStack(): void {
    this.releaseStackEntry = sheetStack.push({
      id: this.id,
      setZIndex: z => {
        this.element.style.zIndex = String(z);
        if (this.backdrop) this.backdrop.style.zIndex = String(z - 1);
      },
      setIsTop: isTop => {
        if (this.backdrop) {
          this.backdrop.style.display = isTop ? "" : "none";
        }
      },
    });
  }

}

export { OverlayEngine as Overlay };
export const createOverlay = (opts: OverlayOptions): OverlayEngine =>
  new OverlayEngine(opts);
