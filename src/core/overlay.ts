import { sheetStack } from "./lifecycle/sheetStack";
import { resolveSnap } from "./primitives/cssLength";
import { devWarn } from "./primitives/devWarn";
import { nextInstanceId } from "./primitives/instance-id";
import { createEventBus, type EventBus } from "./primitives/event-bus";
import { LifecycleController } from "./controllers/lifecycle-controller";
import { prefersReducedMotion } from "./animation/animation";
import {
  closedTransformFor,
  openTransformFor,
  type OverlayAnimation,
  type OverlayEdge,
} from "./primitives/overlay-transforms";
import { installOverlaySwipe } from "./features/overlay-swipe";
import {
  OVERLAY_PRESETS,
  type OverlayCloseReason,
  type OverlayEventMap,
  type OverlayMountTarget,
  type OverlayOptions,
  type OverlayPreset,
  type OverlayState,
  type OverlayUpdate,
  type SwipeToCloseConfig,
} from "./overlay-options";

export type { OverlayAnimation, OverlayEdge };
export { OVERLAY_PRESETS };
export type {
  OverlayCloseReason,
  OverlayEventMap,
  OverlayMountTarget,
  OverlayOptions,
  OverlayPreset,
  OverlayState,
  OverlayUpdate,
  SwipeToCloseConfig,
};

type Listener<K extends keyof OverlayEventMap> = (
  payload: OverlayEventMap[K],
) => void;

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
  private respectReducedMotionEnabled: boolean;
  private isTop = true;
  private backPushed = false;
  private movedToTarget = false;
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
    this.respectReducedMotionEnabled = opts.respectReducedMotion ?? true;
    this.onOpenCb = opts.onOpen;
    this.onCloseCb = opts.onClose;

    if (this.peekRaw !== undefined && this.edge !== "bottom") {
      devWarn(
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
    sheetStack.promote(this.id);
    this.element.removeAttribute("hidden");
    this.element.setAttribute("data-state", "entering");
    if (this.focusTrapEnabled) {
      this.element.setAttribute("aria-modal", "true");
    }

    const dur = this.effectiveDuration();
    const transitionStr = `transform ${dur}ms ${this.enterEasing}, opacity ${dur}ms ease-out`;
    this.element.style.transition = transitionStr;
    if (this.backdrop) {
      this.backdrop.style.transition = `opacity ${dur}ms ease-out`;
    }
    this.setWillChange(true);

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
            this.syncBackdropPointerEvents();
            if (this.backdropFilter) {
              this.applyBackdropFilter(this.backdropFilter);
            }
          }
          try {
            this.installInteractiveListeners();
          } catch (err) {
            this.releaseInteractiveListeners();
            this.isOpen_ = false;
            this.isAnimating_ = false;
            this.setWillChange(false);
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
                this.applyBackdropFilter(undefined);
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
          this.awaitTransition(
            cycle,
            this.enterAnimation === "fade" ? "opacity" : "transform",
          ).then(() => {
            if (this.destroyed || cycle !== this.cycleNonce) return resolve();
            this.isAnimating_ = false;
            this.setWillChange(false);
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
    sheetStack.update();
    this.popBackMarker(reason);
    this.element.setAttribute("data-state", "exiting");

    const dur = this.effectiveDuration();
    const transitionStr = `transform ${dur}ms ${this.exitEasing}, opacity ${dur}ms ease-in`;
    this.element.style.transition = transitionStr;
    if (this.backdrop) {
      this.backdrop.style.transition = `opacity ${dur}ms ease-in`;
    }
    this.setWillChange(true);

    const cycle = ++this.cycleNonce;
    return new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        if (this.destroyed || cycle !== this.cycleNonce) return resolve();
        this.element.style.transform = closedTransformFor(
          this.edge,
          this.exitAnimation,
          this.peekPx,
        );
        this.element.style.opacity = this.peekPx !== undefined ? "1" : "0";
        if (this.backdrop) {
          this.backdrop.style.opacity = "0";
          this.backdrop.style.pointerEvents = "none";
          if (this.backdropFilter) {
            this.applyBackdropFilter(undefined);
          }
        }
        this.releaseInteractiveListeners();
        this.awaitTransition(
          cycle,
          this.exitAnimation === "fade" ? "opacity" : "transform",
        ).then(() => {
          if (this.destroyed || cycle !== this.cycleNonce) return resolve();
          this.isAnimating_ = false;
          this.setWillChange(false);
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
    this.setWillChange(false);
    this.releaseInteractiveListeners();
    this.releaseStackEntry?.();
    this.releaseStackEntry = null;
    const hadOriginalParent = this.originalParent !== null;
    this.restoreMount();
    if (
      this.movedToTarget &&
      !hadOriginalParent &&
      this.element.parentNode
    ) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  setBackdropOpacity(opacity: number): void {
    if (this.destroyed) return;
    this.backdropOpacity = opacity;
    if (this.isOpen_ && this.backdrop) {
      this.backdrop.style.opacity = String(opacity);
      this.syncBackdropPointerEvents();
    }
  }

  setBackdropFilter(filter: string | undefined): void {
    if (this.destroyed) return;
    this.backdropFilter = filter;
    if (!this.isOpen_ || !this.backdrop) return;
    this.applyBackdropFilter(filter);
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
        this.syncBackdropPointerEvents();
      }
      if (merged.backdropFilter !== undefined) {
        this.applyBackdropFilter(this.backdropFilter);
      }
    }

    if (opts.duration !== undefined) this.duration = opts.duration;
    if (opts.enterEasing !== undefined) this.enterEasing = opts.enterEasing;
    if (opts.exitEasing !== undefined) this.exitEasing = opts.exitEasing;
    if (opts.closeOnEscape !== undefined) {
      this.closeOnEscape = opts.closeOnEscape;
      if (!opts.closeOnEscape) {
        this.detachEscape?.();
        this.detachEscape = null;
      } else if (this.isOpen_) {
        this.installInteractiveListeners();
      }
    }
    if (opts.closeOnBackdrop !== undefined) {
      this.closeOnBackdropEnabled = opts.closeOnBackdrop;
      if (!opts.closeOnBackdrop) {
        this.detachBackdrop?.();
        this.detachBackdrop = null;
      } else if (this.isOpen_) {
        this.installInteractiveListeners();
      }
    }
    if (opts.closeOnOutsidePointer !== undefined) {
      this.closeOnOutsidePointerEnabled = opts.closeOnOutsidePointer;
      if (!opts.closeOnOutsidePointer) {
        this.detachOutsidePointer?.();
        this.detachOutsidePointer = null;
      } else if (this.isOpen_) {
        this.installInteractiveListeners();
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

  private effectiveDuration(): number {
    return this.respectReducedMotionEnabled && prefersReducedMotion()
      ? 0
      : this.duration;
  }

  private popBackMarker(reason: OverlayCloseReason): void {
    if (!this.backPushed) return;
    this.backPushed = false;
    if (reason === "back") return;
    const state = history.state as Record<string, unknown> | null;
    if (state && state.__bsOverlay === this.id) {
      try {
        history.back();
      } catch {
        return;
      }
    }
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
    this.movedToTarget = true;
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
    }
  }

  private syncBackdropPointerEvents(): void {
    if (!this.backdrop) return;
    this.backdrop.style.pointerEvents = this.backdropOpacity > 0 ? "auto" : "none";
  }

  private applyBackdropFilter(filter?: string): void {
    if (!this.backdrop) return;
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

  private setWillChange(on: boolean): void {
    this.element.style.willChange = on ? "transform, opacity" : "";
    if (this.backdrop) {
      this.backdrop.style.willChange = on ? "opacity" : "";
    }
  }

  private awaitTransition(
    cycle: number,
    property: "transform" | "opacity" = "transform",
  ): Promise<void> {
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
        if (e.target === this.element && e.propertyName === property) finish();
      };
      this.element.addEventListener("transitionend", onEnd);
      const timer = window.setTimeout(finish, this.effectiveDuration() + 50);
    });
  }

  private installInteractiveListeners(): void {
    this.lifecycle.install();
    if (this.swipeToCloseEnabled && !this.detachSwipe) {
      this.detachSwipe = this.installSwipeToClose();
    }
    if (this.closeOnEscape && !this.detachEscape) {
      const handler = (e: KeyboardEvent) => {
        if (e.defaultPrevented) return;
        if (e.key === "Escape" && this.isOpen_ && this.isTop) {
          void this.close("escape");
        }
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
        this.backPushed = true;
      } catch {
      }
      const onPop = () => {
        if (this.isOpen_ && this.isTop) {
          this.backPushed = false;
          void this.close("back");
        }
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
    return installOverlaySwipe({
      element: this.element,
      edge: this.edge,
      getThreshold: () => this.swipeThreshold,
      getVelocityThreshold: () => this.swipeVelocityThreshold,
      getExitTransition: () =>
        `transform ${this.effectiveDuration()}ms ${this.exitEasing}`,
      getOpenTransform: () => openTransformFor(this.enterAnimation),
      close: () => void this.close("swipe"),
    });
  }

  private registerInStack(): void {
    this.releaseStackEntry = sheetStack.push({
      id: this.id,
      setZIndex: z => {
        this.element.style.zIndex = String(z);
        if (this.backdrop) this.backdrop.style.zIndex = String(z - 1);
      },
      setIsTop: isTop => {
        this.isTop = isTop;
        if (this.backdrop) {
          this.backdrop.style.display = isTop ? "" : "none";
        }
      },
      isOpen: () => this.isOpen_,
    });
  }

}

export { OverlayEngine as Overlay };
export const createOverlay = (opts: OverlayOptions): OverlayEngine =>
  new OverlayEngine(opts);
