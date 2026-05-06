import { sheetStack } from "./lifecycle/sheetStack";
import { CLOSED_TRANSFORM, type TransformAxis } from "./primitives/transform";
import { resolveSnap } from "./primitives/cssLength";
import { nextInstanceId } from "./primitives/instance-id";
import { createEventBus, type EventBus } from "./primitives/event-bus";
import { LifecycleController } from "./controllers/lifecycle-controller";

/**
 * Slide-up panel without gestures. CSS-transition-driven, single-state.
 * Distinct from `BottomSheetEngine`, which is gesture-driven and multi-snap.
 *
 * Shares scroll-lock / focus-trap / sheet-stack / inert-siblings / transform
 * primitives with the engine so z-indices orchestrate automatically when
 * sheets and overlays mix and feature behaviour stays consistent.
 */

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

/**
 * Named overlay archetypes — bundle the common animation + dim + gesture
 * combinations so consumers can opt into a "mode" without restating every
 * field. Applied BEFORE individual options at construction, and as the
 * first step of `setOverlay()` so individual overrides win.
 */
export type OverlayPreset = "sheet" | "dialog" | "sidebar" | "toast";

type OverlayPresetConfig = {
  enterAnimation: OverlayAnimation;
  exitAnimation: OverlayAnimation;
  backdropOpacity: number;
  backdropFilter?: string;
  swipeToClose: boolean | SwipeToCloseConfig;
};

// Frozen so consumers reading the export can't mutate the table by accident.
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

/**
 * Batch payload for `setOverlay()`. `null` on `backdropFilter` clears it
 * (distinct from `undefined` which means "leave as-is" in the diff). Apply
 * order: preset first, then individual overrides — single DOM-write phase
 * if the overlay is currently open.
 */
export type OverlayUpdate = {
  backdropOpacity?: number;
  backdropFilter?: string | null;
  swipeToClose?: boolean | SwipeToCloseConfig;
  enterAnimation?: OverlayAnimation;
  exitAnimation?: OverlayAnimation;
  preset?: OverlayPreset;
  /**
   * Runtime children swap. `null` clears the panel's contents. A function is
   * called once to lazy-resolve dynamic content. Applied LAST in the batch so
   * style mutations finish before the DOM swap.
   */
  children?: HTMLElement | DocumentFragment | (() => HTMLElement | DocumentFragment) | null;
};

export type OverlayOptions = {
  /** The panel element — gets transform/opacity inline writes. */
  element: HTMLElement;
  /** Optional dimmed backdrop element. */
  backdrop?: HTMLElement;
  /** Edge the panel slides in from. Default: "bottom". */
  edge?: OverlayEdge;
  /** Open immediately on construction. Default: false. */
  initialOpen?: boolean;
  /** Listen for Escape key. Default: true. */
  closeOnEscape?: boolean;
  /** Tap on backdrop closes. Default: true. */
  closeOnBackdrop?: boolean;
  /** Trap Tab focus inside the panel. Default: true. */
  focusTrap?: boolean;
  /** Selector or HTMLElement focused on open. */
  initialFocus?: string | HTMLElement;
  /**
   * Element to focus after close. By default the focus trap restores
   * whatever was focused before open. Pass an element or a getter for
   * explicit control (e.g. focus a status banner instead of the trigger).
   */
  returnFocus?: HTMLElement | (() => HTMLElement | null);
  /** Lock body scroll while open. Default: true. */
  lockBodyScroll?: boolean;
  /** Mark page siblings `inert` while open (full a11y modal). Default: false. */
  inertSiblings?: boolean;
  /** Push history state so Android back closes the overlay. Default: false. */
  closeOnBack?: boolean;
  /** Animation duration in ms. Default: 320. */
  duration?: number;
  /** CSS easing for the slide-in. Default matches monitoring's bezier. */
  enterEasing?: string;
  /** CSS easing for the slide-out. Default: ease-in. */
  exitEasing?: string;
  /**
   * Peak backdrop opacity when open. Useful when `backdropFilter` blur
   * already darkens enough and the dim should be light (e.g. 0.3).
   * Default: 1.
   */
  backdropOpacity?: number;
  /**
   * CSS `backdrop-filter` value applied to the backdrop while open
   * (e.g. `"blur(8px)"`, `"blur(12px) saturate(140%)"`). Cleared on close.
   */
  backdropFilter?: string;
  /**
   * Allow drag-to-dismiss along the entry edge — pointer-driven. The panel
   * follows the finger past the closed-edge axis and dismisses if the user
   * crosses 30% of the panel size or releases with > 0.5 px/ms velocity.
   *
   * Pass a config object to tune thresholds:
   *   `{ enabled: true, threshold: 0.5, velocityThreshold: 1.0 }`.
   * Default: false (CSS-only transition).
   */
  swipeToClose?: boolean | SwipeToCloseConfig;
  /**
   * Entry animation. `"slide"` (default) translates from the edge.
   * `"fade"` is opacity-only (no transform). `"scale"` fades + scales
   * from 0.94 — best for centred dialogs.
   */
  enterAnimation?: OverlayAnimation;
  /** Exit animation. Defaults to `enterAnimation`. */
  exitAnimation?: OverlayAnimation;
  /**
   * Move `element` to a different container on first open. `'parent'`
   * (default) leaves it in place. `'body'` appends to `document.body`.
   * Pass an explicit `HTMLElement` for any other portal target.
   *
   * Restored to its original parent on `destroy()`. Move is deferred to
   * first `open()` so SSR / pre-mount construction doesn't crash.
   */
  mountTo?: OverlayMountTarget;
  /**
   * `peek` keeps part of the panel visible when closed instead of
   * translating fully off-screen. Number is treated as pixels; strings
   * accept any CSS length (`"10dvh"`, `"clamp(40px, 8vh, 80px)"`).
   * Only honoured when `edge: 'bottom'` — warns and falls back otherwise.
   */
  peek?: number | string;
  /**
   * Close when a pointerdown lands outside `element` AND outside `backdrop`.
   * Distinct from `closeOnBackdrop` — this fires even when no backdrop is
   * mounted. Single document-level listener, removed on close.
   */
  closeOnOutsidePointer?: boolean;
  /**
   * Named archetype — bundles `enterAnimation`/`exitAnimation`/
   * `backdropOpacity`/`backdropFilter`/`swipeToClose` defaults. Applied
   * BEFORE the individual options on this object, so any explicit field
   * still wins over the preset's default.
   */
  preset?: OverlayPreset;
  /** Lifecycle callbacks. */
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

// Wrapper around the shared CLOSED_TRANSFORM map — preserves the original
// function-based signature so call sites stay terse.
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
      // Peek only applies to bottom-edge slide — caller already validated edge.
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
  // Definite-assignment: written via assignSwipeFromConfig in the
  // constructor — TS can't follow the helper, mark the assertion explicit.
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
  // Tracks whether setOverlayChildren ever populated the panel — lets
  // clearOverlayChildren skip the DOM mutation when nothing was injected
  // (so the field also acts as a zero-allocation feature flag).
  private hasInjectedChildren = false;
  // Bumped on every open/close. awaitTransition captures it and ignores
  // transitionend/timeout fired by older cycles — prevents cross-cycle
  // listener bleed during rapid toggling.
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

    // Preset is the FIRST layer — fields below override it when explicit.
    // Using `in` checks on the user opts so a preset value isn't clobbered
    // by an undefined field that was never written by the caller.
    const preset = opts.preset ? OVERLAY_PRESETS[opts.preset] : undefined;
    this.backdropOpacity =
      opts.backdropOpacity ?? preset?.backdropOpacity ?? 1;
    this.backdropFilter =
      opts.backdropFilter ?? preset?.backdropFilter ?? undefined;

    // Normalize swipeToClose union to flat fields — hot path reads bare
    // numbers, no per-event object access. Preset acts as the fallback when
    // the caller didn't specify swipeToClose explicitly.
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

    // Warn-and-ignore: peek only makes geometric sense for the bottom edge
    // (closed transform leaves the panel below the viewport). Other edges
    // would need separate calc()s — out of scope for this PR.
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
        // Overlay-specific guard: only paint body siblings inert when the
        // overlay element is actually a body descendant. Detached / shadow-
        // DOM / portal overlays would otherwise lock unrelated trees.
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
      // Double-rAF: commit closed-state styles, then apply open-state on the
      // next frame so the browser actually fires a transition.
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
          // If listener install throws (detached focus target, shadow-DOM
          // weirdness), revert to closed so the user isn't stuck in an
          // undismissable overlay. Still resolve the promise so awaiters
          // don't hang.
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
          // Peek leaves the panel partially visible — do NOT hide it via
          // [hidden] in that case, otherwise the peek strip disappears.
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
    // Let pending rAFs fire and resolve via the destroyed-guard; cancelling
    // them would leave open()/close() promises hanging.
    this.destroyed = true;
    this.cycleNonce++;
    this.bus.clear();
    this.releaseInteractiveListeners();
    this.releaseStackEntry?.();
    this.releaseStackEntry = null;
    this.restoreMount();
  }

  /**
   * Runtime visual setter — opacity is applied immediately when open so a
   * live-controls panel can preview the change without re-opening. When
   * closed we only stash the field; next open() picks it up so we don't
   * mutate hidden DOM (avoids paint thrash on detached panels).
   */
  setBackdropOpacity(opacity: number): void {
    if (this.destroyed) return;
    this.backdropOpacity = opacity;
    if (this.isOpen_ && this.backdrop) {
      this.backdrop.style.opacity = String(opacity);
    }
  }

  /**
   * Runtime visual setter for `backdrop-filter`. `undefined` clears the
   * filter (mirrors the close() behaviour). Defers to next open() when the
   * overlay is currently closed.
   */
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

  /**
   * Toggle / reconfigure swipe-to-close at runtime. Re-resolves the flat
   * threshold fields, then installs or tears down the pointer listener so
   * the change applies to the CURRENT open cycle. Idempotent: safe to call
   * with the same config repeatedly.
   */
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

  /** Animation setters only stage the field — applied on next open/close. */
  setEnterAnimation(animation: OverlayAnimation): void {
    if (this.destroyed) return;
    this.enterAnimation = animation;
  }

  setExitAnimation(animation: OverlayAnimation): void {
    if (this.destroyed) return;
    this.exitAnimation = animation;
  }

  /** Updates the field used at next close() — no immediate side effect. */
  setReturnFocus(
    target: HTMLElement | (() => HTMLElement | null) | undefined,
  ): void {
    if (this.destroyed) return;
    this.lifecycle.setReturnFocus(target);
  }

  /**
   * Batch update — preset first, then individual overrides. Applied as a
   * single DOM-write phase when open so live-controls don't trigger
   * cascading reflows. Safe to call when closed (defers to next open).
   */
  setOverlay(opts: OverlayUpdate): void {
    if (this.destroyed) return;
    // Preset baseline — pulled into a normalized OverlayUpdate so individual
    // fields below can override cleanly without branching on each one.
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
          // Preset's `undefined` filter means "no filter" — surface as null
          // so the merged step clears the field instead of inheriting old.
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

    // Field-only updates first (no DOM writes); animation/swipe live in
    // private state and don't touch the panel mid-cycle.
    if (merged.enterAnimation !== undefined) {
      this.enterAnimation = merged.enterAnimation;
    }
    if (merged.exitAnimation !== undefined) {
      this.exitAnimation = merged.exitAnimation;
    }
    if (merged.swipeToClose !== undefined) {
      // Reuse the public setter so install/teardown bookkeeping stays in
      // one place — it short-circuits cleanly when called multiple times.
      this.setSwipeToClose(merged.swipeToClose);
    }

    // Single batched DOM-write phase — only one read of `isOpen_` + at most
    // two backdrop.style assignments instead of one per field.
    if (merged.backdropOpacity !== undefined) {
      this.backdropOpacity = merged.backdropOpacity;
    }
    if (merged.backdropFilter !== undefined) {
      // null means "clear" — collapse to undefined for the field.
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

    // Children swap goes LAST — style mutations above operate on the panel's
    // computed values, so doing the DOM replacement after avoids any chance
    // of style writes landing on nodes about to be detached.
    if (opts.children !== undefined) {
      if (opts.children === null) {
        this.clearOverlayChildren();
      } else {
        this.setOverlayChildren(opts.children);
      }
    }
  }

  /**
   * Runtime children injection — replace the panel's contents without
   * unmounting the engine. `replaceChildren()` is a single atomic DOM op,
   * so callers can swap content rapidly without intermediate flicker.
   * Function form is resolved exactly ONCE per call (cheap lazy content).
   */
  setOverlayChildren(
    children: HTMLElement | DocumentFragment | (() => HTMLElement | DocumentFragment),
  ): void {
    if (this.destroyed) return;
    // Resolve the lazy form here — calling inside replaceChildren would
    // either re-evaluate or pass a function as a node (TypeError).
    const node = typeof children === "function" ? children() : children;
    this.element.replaceChildren(node);
    this.hasInjectedChildren = true;
  }

  /**
   * Clear injected children. No-op when nothing was injected so consumers
   * who never used setOverlayChildren can call this defensively without
   * paying for a DOM mutation.
   */
  clearOverlayChildren(): void {
    if (this.destroyed || !this.hasInjectedChildren) return;
    this.element.replaceChildren();
    this.hasInjectedChildren = false;
  }

  // Shared swipe-config normalizer — used by constructor, setSwipeToClose,
  // and setOverlay so the union/object shape is decoded in exactly one place.
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
    // resolveSnap handles dvh/clamp/env() via the shared probe; fall back
    // to 0 in non-DOM environments (constructor may run before mount).
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
    // appendChild moves the node if it already lives elsewhere — no-op when
    // it's already a child of `target`, so calling repeatedly is safe.
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
      /* original parent went away — leave element where it is */
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
    // Peek implies the panel is meant to be visible when "closed" — don't
    // zero opacity, otherwise nothing peeks.
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
    // Resolve on the first transform transitionend OR a duration-based
    // fallback. Stale-cycle paths still resolve so awaiting promises don't
    // hang; the outer .then() re-checks cycleNonce before mutating state.
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
        /* ignore — sandboxed iframe */
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
      // Capture phase so dialogs nested inside other overlays still close
      // before child handlers can stop propagation.
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

  /**
   * Light pointer-driven dismiss. Tracks finger along the edge axis, follows
   * with translate, dismisses if past `swipeThreshold` (fraction of panel
   * size) or release velocity exceeds `swipeVelocityThreshold` (px/ms).
   * Pure CSS-transform during drag — no rAF or physics required since the
   * panel only moves one direction.
   */
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
        /* iOS WebKit < 14.5 */
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
