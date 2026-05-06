import { installFocusTrap } from "../lifecycle/focusTrap";
import { lockBodyScroll } from "../lifecycle/scrollLock";
import {
  createInertSiblings,
  type InertSiblingsHandle,
} from "../features/inert-siblings";

/**
 * Engine callbacks consumed by the controller — passed once at construction.
 * Controller never reads engine state directly; the boundary stays clean.
 */
export type LifecycleControllerDeps = {
  /** Sheet element — focus trap install target + inert-siblings root provider. */
  element: HTMLElement;
  /** Engine.close() — wired into focus-trap onEscape when closeOnEscape is true. */
  close: () => Promise<void> | void;
};

export type LifecycleControllerOptions = {
  focusTrap?: boolean;
  initialFocus?: string | HTMLElement;
  closeOnEscape?: boolean;
  lockBodyScroll?: boolean;
  inertSiblings?: boolean;
  /**
   * Predicate run before each `inertSiblings.apply()`. Returning false skips
   * that call without disabling the feature outright. Used by overlay to
   * guard against marking unrelated body children inert when the panel
   * isn't actually a body descendant (detached / shadow-DOM / portal cases).
   */
  shouldApplyInertSiblings?: () => boolean;
  /**
   * Element (or resolver) to focus after `release()`. Overlay needs this to
   * restore focus to the trigger button on dismiss; engine wires its own
   * focus restoration through the focus-trap teardown so it leaves this
   * undefined.
   */
  returnFocus?: HTMLElement | (() => HTMLElement | null);
};

/**
 * Owns the open/close-time install dance: scroll lock, focus trap, inert
 * siblings. Each is independently configurable; the controller wires them
 * up consistently and keeps the toggle-state teardowns in named fields so
 * `release()` can drop them without affecting destroy-only listeners on
 * the engine's TeardownStack.
 *
 * Engine retains `handleOpen` / `handleClose` because the rollback path on
 * failure needs engine-owned state (cycle bump, applySize, activeId reset).
 * Controller exposes thin `install()` / `release()` so engine can drive
 * inside its try/catch.
 *
 * @internal
 */
export class LifecycleController {
  private element: HTMLElement;
  private closeFn: () => Promise<void> | void;

  readonly focusTrapEnabled: boolean;
  readonly initialFocus?: string | HTMLElement;
  readonly closeOnEscape: boolean;
  readonly bodyScrollLockEnabled: boolean;
  readonly inertSiblingsEnabled: boolean;

  private inertSiblings: InertSiblingsHandle;
  private shouldApplyInertSiblings: () => boolean;
  private returnFocus?: HTMLElement | (() => HTMLElement | null);
  /** Toggle-state teardowns — fire on close, NOT in destroy-only stack. */
  private releaseFocusTrap: (() => void) | null = null;
  private releaseScrollLock: (() => void) | null = null;
  /** True between install() and release(). Guards release()/destroy() from
   *  re-running side effects (notably `returnFocus.focus()`) on already-
   *  released or never-installed instances. */
  private installed = false;
  private destroyed = false;

  constructor(deps: LifecycleControllerDeps, opts: LifecycleControllerOptions) {
    this.element = deps.element;
    this.closeFn = deps.close;
    this.focusTrapEnabled = opts.focusTrap ?? false;
    this.initialFocus = opts.initialFocus;
    this.closeOnEscape = opts.closeOnEscape ?? true;
    this.bodyScrollLockEnabled = opts.lockBodyScroll ?? true;
    this.inertSiblingsEnabled = opts.inertSiblings ?? false;
    this.shouldApplyInertSiblings = opts.shouldApplyInertSiblings ?? (() => true);
    this.returnFocus = opts.returnFocus;
    this.inertSiblings = createInertSiblings(() => this.element);
  }

  /**
   * Run the open-time install steps. Idempotent: each step checks its
   * existing teardown ref so a re-open during a half-cancelled close
   * doesn't double-install. Sets `installed=true` BEFORE the first side
   * effect so a partial throw (detached / shadow-DOM target) leaves the
   * caller's `release()` rollback path armed to undo whatever did succeed.
   * No-op when destroyed.
   */
  install(): void {
    if (this.destroyed) return;
    this.installed = true;
    if (this.bodyScrollLockEnabled && !this.releaseScrollLock) {
      this.releaseScrollLock = lockBodyScroll();
    }
    if (this.focusTrapEnabled && !this.releaseFocusTrap) {
      this.releaseFocusTrap = installFocusTrap(this.element, {
        initialFocus: this.initialFocus,
        onEscape: this.closeOnEscape ? () => void this.closeFn() : undefined,
      });
    }
    if (this.inertSiblingsEnabled && this.shouldApplyInertSiblings()) {
      this.inertSiblings.apply();
    }
  }

  /**
   * Update the post-release focus target. Overlay re-binds this when the
   * consumer changes `returnFocus` after construction; the new value applies
   * on the next `release()`. No-op when destroyed.
   */
  setReturnFocus(
    target: HTMLElement | (() => HTMLElement | null) | undefined,
  ): void {
    if (this.destroyed) return;
    this.returnFocus = target;
  }

  /**
   * Release all install-time teardowns. Short-circuits when not installed,
   * so `close() → destroy()` (each routing through here) only restores
   * focus once. The `installed` guard lets `inertSiblings.remove()` and
   * the focus-trap/scroll-lock teardown nullings stay simple — they were
   * already idempotent, but `returnFocus.focus()` was firing on every call.
   */
  release(): void {
    if (!this.installed) return;
    this.installed = false;
    this.releaseFocusTrap?.();
    this.releaseFocusTrap = null;
    this.releaseScrollLock?.();
    this.releaseScrollLock = null;
    this.inertSiblings.remove();
    if (this.returnFocus) {
      const target =
        typeof this.returnFocus === "function"
          ? this.returnFocus()
          : this.returnFocus;
      target?.focus?.();
    }
  }

  /**
   * Final teardown — releases any still-installed listeners and seals the
   * controller. After destroy(), install() is a no-op and setReturnFocus()
   * is rejected, so post-destroy mutations can't queue up a stale focus
   * restore.
   */
  destroy(): void {
    this.release();
    this.destroyed = true;
  }
}
