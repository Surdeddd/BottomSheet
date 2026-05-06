import { installGestures } from "../gestures";
import { rubberBand } from "../primitives/rubber-band";
import { dismissSoftKeyboardIfFocused } from "../features/soft-keyboard";
import type { SheetMode, SheetEventMap } from "../types";

/**
 * Engine callbacks consumed by the gesture controller. Pulled into a
 * structural type so the engine doesn't have to expose internals as public
 * methods just for the controller to reach them.
 */
export type GestureControllerDeps = {
  /** Drag handle element — pointer events are bound here, not on the sheet. */
  handle: HTMLElement;
  /** Sheet element — toggles `will-change: transform` during drag. */
  element: HTMLElement;
  /** Axis mode — selects which delta sign maps to "open" vs "close". */
  mode: SheetMode;
  /** Outer root element — gets `data-dragging="true"` for scoped styles. */
  getRoot: () => HTMLElement | null;

  /**
   * Engine state read on every onMove (rubber-band + clamp use live ranges).
   * One call per frame returns all four values so DI surface stays narrow
   * and the hot path doesn't pay for four getter dispatches per move event.
   */
  getDragContext: () => {
    size: number;
    maxAxisSize: number;
    range: { min: number; max: number };
    rubberBandEnabled: boolean;
  };

  /** Cancel any in-flight animation when a new drag starts. */
  cancelAnimation: () => void;
  /** Write size to the host element + cached CSS vars. */
  applySize: (size: number) => void;
  /** Animate back to a specific size (used by onCancel). */
  animateTo: (size: number, velocity: number) => Promise<void>;
  /** Run the engine's settle-after-drag policy (snap target resolution etc). */
  settleAfterDrag: (
    delta: number,
    velocity: number,
    kind: "touch" | "mouse" | "pen",
  ) => void;
  /** Emit on the engine's bus — typed via SheetEventMap. */
  emit: <K extends keyof SheetEventMap>(
    event: K,
    payload: SheetEventMap[K],
  ) => void;
  /** Listener count on a given event — used to skip drag-event payload alloc. */
  listenerCount: (event: keyof SheetEventMap) => number;
};

/**
 * Owns the pointer-event ↔ size-translation pipeline: drag-start state
 * snapshot, rubber-band clamping in onMove, drag-end → settle handoff,
 * and the "drag down to dismiss soft keyboard" iOS Safari mirror.
 *
 * Extracted from the engine so the gesture math + state machine is testable
 * in isolation and the engine class stays focused on orchestration. The
 * controller owns its own `isDragging`, `dragStartSize`, `currentPointerKind`,
 * `keyboardDismissed` flags — engine reads `isDragging` via `getIsDragging()`
 * for resize-observer / content-swipe gating.
 *
 * @internal
 */
export class GestureController {
  private deps: GestureControllerDeps;
  private detach: (() => void) | null = null;

  private isDragging_ = false;
  private dragStartSize = 0;
  // Only "touch" gestures are eligible for soft-keyboard dismissal —
  // mouse/trackpad users don't have a keyboard to dismiss.
  private currentPointerKind: "touch" | "mouse" | "pen" = "touch";
  // One blur per drag — flipping focus every move event races the keyboard's
  // own animations on iOS and makes the page jitter.
  private keyboardDismissed = false;
  // Reused payload object for the "drag" event — mutated each onMove instead
  // of allocating a fresh `{size, delta}` per frame. At 60-120Hz a long drag
  // would otherwise churn tens of KB through the GC. Mirrors browser
  // PointerEvent semantics: consumers must NOT retain the reference across
  // frames (clone if needed). See SheetEventMap.drag JSDoc.
  private dragPayload: SheetEventMap["drag"] = { size: 0, delta: 0 };

  constructor(deps: GestureControllerDeps) {
    this.deps = deps;
  }

  /** True between `dragstart` and `dragend`/`onCancel`. */
  get isDragging(): boolean {
    return this.isDragging_;
  }

  /**
   * Bind pointer listeners on the handle and return a teardown. Engine pushes
   * the teardown into its TeardownStack so destroy() drains it once.
   */
  install(): () => void {
    if (this.detach) return this.detach;
    this.detach = installGestures(this.deps.handle, this.deps.mode, {
      onStart: (_coord, kind) => {
        this.deps.cancelAnimation();
        this.isDragging_ = true;
        // Snapshot once at start — onMove uses dragStartSize alone for the
        // base position; only the rubber-band geometry needs live ranges.
        this.dragStartSize = this.deps.getDragContext().size;
        this.currentPointerKind = kind;
        this.keyboardDismissed = false;
        this.deps.getRoot()?.setAttribute("data-dragging", "true");
        this.deps.element.style.willChange = "transform";
        this.deps.emit("dragstart", { size: this.dragStartSize });
      },
      onMove: delta => {
        const ctx = this.deps.getDragContext();
        const { min, max } = ctx.range;
        const maxAxis = ctx.maxAxisSize;
        const rubberOn = ctx.rubberBandEnabled;
        let next = this.dragStartSize + delta;
        if (next > max) {
          next = rubberOn ? max + rubberBand(next - max, maxAxis) : max;
        } else if (next < min) {
          next = rubberOn ? min - rubberBand(min - next, maxAxis) : min;
        }
        this.deps.applySize(next);
        // Mirrors native iOS Safari drag-to-dismiss-keyboard. Gated to one
        // blur per drag because repeated blurs race the keyboard's own
        // animation and cause jitter.
        if (
          !this.keyboardDismissed &&
          this.currentPointerKind === "touch" &&
          this.deps.mode === "bottom" &&
          next < this.dragStartSize
        ) {
          if (dismissSoftKeyboardIfFocused(this.deps.element)) {
            this.keyboardDismissed = true;
          }
        }
        if (this.deps.listenerCount("drag") > 0) {
          this.dragPayload.size = next;
          this.dragPayload.delta = delta;
          this.deps.emit("drag", this.dragPayload);
        }
      },
      onEnd: (delta, velocity, kind) => {
        this.isDragging_ = false;
        this.keyboardDismissed = false;
        this.deps.getRoot()?.removeAttribute("data-dragging");
        this.deps.emit("dragend", {
          size: this.deps.getDragContext().size,
          velocity,
        });
        this.deps.settleAfterDrag(delta, velocity, kind);
      },
      onCancel: () => {
        this.isDragging_ = false;
        this.keyboardDismissed = false;
        this.deps.getRoot()?.removeAttribute("data-dragging");
        const restoreTo = this.dragStartSize;
        void this.deps.animateTo(restoreTo, 0);
      },
    });
    return this.detach;
  }

  /**
   * Force-clear drag visual state. Engine calls from destroy() when destroyed
   * mid-drag — gesture detach won't synthesize an onCancel, so we have to
   * roll back the data-attribute + will-change ourselves.
   */
  forceClearDragState(): void {
    if (!this.isDragging_) return;
    this.isDragging_ = false;
    this.keyboardDismissed = false;
    this.deps.getRoot()?.removeAttribute("data-dragging");
    this.deps.element.style.willChange = "auto";
  }
}
