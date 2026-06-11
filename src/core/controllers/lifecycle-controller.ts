import { installFocusTrap } from "../lifecycle/focusTrap";
import { lockBodyScroll } from "../lifecycle/scrollLock";
import {
  createInertSiblings,
  type InertSiblingsHandle,
} from "../features/inert-siblings";

export type LifecycleControllerDeps = {
  element: HTMLElement;
  close: () => Promise<void> | void;
};

export type LifecycleControllerOptions = {
  focusTrap?: boolean;
  initialFocus?: string | HTMLElement;
  closeOnEscape?: boolean;
  lockBodyScroll?: boolean;
  inertSiblings?: boolean;
  shouldApplyInertSiblings?: () => boolean;
  returnFocus?: HTMLElement | (() => HTMLElement | null);
};

export class LifecycleController {
  private element: HTMLElement;

  readonly focusTrapEnabled: boolean;
  readonly initialFocus?: string | HTMLElement;
  readonly closeOnEscape: boolean;
  readonly bodyScrollLockEnabled: boolean;
  readonly inertSiblingsEnabled: boolean;

  private inertSiblings: InertSiblingsHandle;
  private shouldApplyInertSiblings: () => boolean;
  private returnFocus?: HTMLElement | (() => HTMLElement | null);
  private releaseFocusTrap: (() => void) | null = null;
  private releaseScrollLock: (() => void) | null = null;
  private installed = false;
  private destroyed = false;

  get isInstalled(): boolean {
    return this.installed;
  }

  constructor(deps: LifecycleControllerDeps, opts: LifecycleControllerOptions) {
    this.element = deps.element;
    this.focusTrapEnabled = opts.focusTrap ?? false;
    this.initialFocus = opts.initialFocus;
    this.closeOnEscape = opts.closeOnEscape ?? true;
    this.bodyScrollLockEnabled = opts.lockBodyScroll ?? true;
    this.inertSiblingsEnabled = opts.inertSiblings ?? false;
    this.shouldApplyInertSiblings = opts.shouldApplyInertSiblings ?? (() => true);
    this.returnFocus = opts.returnFocus;
    this.inertSiblings = createInertSiblings(() => this.element);
  }

  install(): void {
    if (this.destroyed) return;
    this.installed = true;
    if (this.bodyScrollLockEnabled && !this.releaseScrollLock) {
      this.releaseScrollLock = lockBodyScroll();
    }
    if (this.focusTrapEnabled && !this.releaseFocusTrap) {
      this.releaseFocusTrap = installFocusTrap(this.element, {
        initialFocus: this.initialFocus,
      });
    }
    if (this.inertSiblingsEnabled && this.shouldApplyInertSiblings()) {
      this.inertSiblings.apply();
    }
  }

  setReturnFocus(
    target: HTMLElement | (() => HTMLElement | null) | undefined,
  ): void {
    if (this.destroyed) return;
    this.returnFocus = target;
  }

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

  destroy(): void {
    this.release();
    this.destroyed = true;
  }
}
