import { installGestures } from "../gestures";
import { rubberBand } from "../primitives/rubber-band";
import { dismissSoftKeyboardIfFocused } from "../features/soft-keyboard";
import type { SheetMode, SheetEventMap } from "../types";

export type GestureControllerDeps = {
  handle: HTMLElement;
  element: HTMLElement;
  mode: SheetMode;
  getRoot: () => HTMLElement | null;

  getDragContext: () => {
    size: number;
    maxAxisSize: number;
    range: { min: number; max: number };
    rubberBandEnabled: boolean;
  };

  cancelAnimation: () => void;
  applySize: (size: number) => void;
  animateTo: (size: number, velocity: number) => Promise<void>;
  settleAfterDrag: (
    delta: number,
    velocity: number,
    kind: "touch" | "mouse" | "pen",
  ) => void;
  emit: <K extends keyof SheetEventMap>(
    event: K,
    payload: SheetEventMap[K],
  ) => void;
  listenerCount: (event: keyof SheetEventMap) => number;
};

export class GestureController {
  private deps: GestureControllerDeps;
  private detach: (() => void) | null = null;

  private isDragging_ = false;
  private dragStartSize = 0;
  private currentPointerKind: "touch" | "mouse" | "pen" = "touch";
  private keyboardDismissed = false;
  private dragPayload: SheetEventMap["drag"] = { size: 0, delta: 0 };

  constructor(deps: GestureControllerDeps) {
    this.deps = deps;
  }

  get isDragging(): boolean {
    return this.isDragging_;
  }

  install(): () => void {
    if (this.detach) return this.detach;
    this.detach = installGestures(this.deps.handle, this.deps.mode, {
      onStart: (_coord, kind) => {
        this.deps.cancelAnimation();
        this.isDragging_ = true;
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
        this.deps.emit("dragend", {
          size: this.deps.getDragContext().size,
          velocity: 0,
        });
        const restoreTo = this.dragStartSize;
        void this.deps.animateTo(restoreTo, 0);
      },
    });
    return this.detach;
  }

  forceClearDragState(): void {
    if (!this.isDragging_) return;
    this.isDragging_ = false;
    this.keyboardDismissed = false;
    this.deps.getRoot()?.removeAttribute("data-dragging");
    this.deps.element.style.willChange = "auto";
  }
}
