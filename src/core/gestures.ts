import { MOUSE_DRAG_THRESHOLD } from "./primitives/snap-points";
import type { SheetMode } from "./types";

export type PointerSample = { t: number; v: number };
export type PointerKind = "touch" | "mouse" | "pen";

export type GestureCallbacks = {
  onStart: (axisCoord: number, pointerType: PointerKind) => void;
  onMove: (delta: number) => void;
  onEnd: (delta: number, velocity: number, pointerType: PointerKind) => void;
  onCancel?: () => void;
};

export type GestureOptions = {

  shouldStart?: (e: PointerEvent) => boolean;

  deferStart?: (
    e: PointerEvent,
    delta: number,
    crossDelta: number,
  ) => boolean | null;

  manageTouchAction?: boolean;
};

const isAxisVertical = (mode: SheetMode) => mode === "bottom" || mode === "top";

const PAGE_POINTER_EVENTS = ["pointermove", "pointerup", "pointercancel"] as const;

class SampleRing {
  private readonly slots: PointerSample[];
  private readonly capacity: number;
  private head = 0;
  private size = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.slots = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.slots[i] = { t: 0, v: 0 };
  }

  push(t: number, v: number): void {
    const slot = this.slots[this.head]!;
    slot.t = t;
    slot.v = v;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
  }

  pruneBefore(cutoff: number, minKeep: number): void {
    while (this.size > minKeep) {
      const oldestIdx =
        (this.head - this.size + this.capacity) % this.capacity;
      if (this.slots[oldestIdx]!.t < cutoff) this.size--;
      else break;
    }
  }

  get length(): number {
    return this.size;
  }

  oldest(): PointerSample | undefined {
    if (this.size === 0) return undefined;
    return this.slots[(this.head - this.size + this.capacity) % this.capacity];
  }

  newest(): PointerSample | undefined {
    if (this.size === 0) return undefined;
    return this.slots[(this.head - 1 + this.capacity) % this.capacity];
  }

  reset(): void {
    this.head = 0;
    this.size = 0;
  }
}

export const installGestures = (
  handle: HTMLElement,
  mode: SheetMode,
  callbacks: GestureCallbacks,
  options: GestureOptions = {},
): (() => void) => {
  let activePointerId: number | null = null;
  let activePointerType: PointerKind = "touch";
  let startCoord = 0;
  let startCross = 0;
  let lastCoord = 0;
  let pendingStart = false;
  let movedInTask = false;
  let captured = false;
  let pressedButton = false;
  let lastMove: Event | null = null;
  const VELOCITY_WINDOW_MS = (kind: PointerKind) =>
    kind === "mouse" ? 160 : 120;
  const MAX_SAMPLES = 32;
  const samples = new SampleRing(MAX_SAMPLES);

  const axis = isAxisVertical(mode) ? "Y" : "X";
  const sign = mode === "bottom" || mode === "right" ? -1 : 1;

  const coordOf = (e: PointerEvent): number =>
    axis === "Y" ? e.clientY : e.clientX;

  const crossOf = (e: PointerEvent): number =>
    axis === "Y" ? e.clientX : e.clientY;

  const capture = (pointerId: number): void => {
    captured = true;
    try {
      handle.setPointerCapture(pointerId);
    } catch {
    }
  };

  const endOfTask = (): void => {
    movedInTask = false;
  };

  const releaseTracking = (): void => {
    activePointerId = null;
    pendingStart = false;
    movedInTask = false;
    captured = false;
    pressedButton = false;
    samples.reset();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (activePointerId !== null) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (options.shouldStart && !options.shouldStart(e)) return;
    activePointerId = e.pointerId;
    activePointerType =
      (e.pointerType as PointerKind) || "touch";
    pressedButton = activePointerType !== "touch" && e.buttons > 0;
    startCoord = coordOf(e);
    startCross = crossOf(e);
    lastCoord = startCoord;
    samples.reset();
    samples.push(e.timeStamp, startCoord);
    if (options.deferStart) {
      pendingStart = true;
      return;
    }
    if (activePointerType === "touch") capture(e.pointerId);
    callbacks.onStart(startCoord, activePointerType);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId || e === lastMove) return;
    lastMove = e;
    if (pressedButton && e.buttons === 0) {
      samples.reset();
      finishGesture(e);
      return;
    }
    const coord = coordOf(e);
    const rawDelta = coord - startCoord;
    const delta = rawDelta * sign;
    if (pendingStart) {
      const verdict = options.deferStart!(e, delta, crossOf(e) - startCross);
      if (verdict === false) {
        releaseTracking();
        return;
      }
      if (verdict !== true) return;
      pendingStart = false;

      startCoord = coord;
      lastCoord = coord;
      samples.reset();
      samples.push(e.timeStamp, coord);
      capture(e.pointerId);
      callbacks.onStart(startCoord, activePointerType);
      return;
    }
    if (
      !captured &&
      Math.max(Math.abs(rawDelta), Math.abs(crossOf(e) - startCross)) >
        MOUSE_DRAG_THRESHOLD
    ) {
      capture(e.pointerId);
    }
    lastCoord = coord;
    samples.push(e.timeStamp, coord);
    const cutoff = e.timeStamp - VELOCITY_WINDOW_MS(activePointerType);
    samples.pruneBefore(cutoff, 2);
    if (!movedInTask) {
      movedInTask = true;
      setTimeout(endOfTask);
    }
    callbacks.onMove(delta);
  };

  const finishGesture = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    if (pendingStart) {
      releaseTracking();
      return;
    }
    const rawDelta = lastCoord - startCoord;
    const delta = rawDelta * sign;
    let velocity = 0;
    const last = samples.newest();
    if (
      samples.length >= 3 &&
      last &&
      e.timeStamp - last.t <= VELOCITY_WINDOW_MS(activePointerType)
    ) {
      const first = samples.oldest()!;
      const dt = last.t - first.t;
      if (dt > 0) velocity = ((last.v - first.v) / dt) * sign;
    }
    const finishedKind = activePointerType;
    activePointerId = null;
    movedInTask = false;
    captured = false;
    pressedButton = false;
    samples.reset();
    try {
      if (handle.hasPointerCapture(e.pointerId)) {
        handle.releasePointerCapture(e.pointerId);
      }
    } catch {
    }
    callbacks.onEnd(delta, velocity, finishedKind);
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    const wasPending = pendingStart;
    releaseTracking();
    if (wasPending) return;
    callbacks.onCancel?.();
  };

  const onLostCapture = (e: PointerEvent) => {
    if (e.target === handle) onPointerCancel(e);
  };

  const onPagePointer = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId || pendingStart) return;
    if (captured && !(pressedButton && e.buttons === 0)) return;
    if (e.type === "pointermove") onPointerMove(e);
    else if (e.type === "pointerup") finishGesture(e);
    else onPointerCancel(e);
  };

  const onNativeDrag = (e: Event) => {
    if (activePointerId !== null && !pendingStart) e.preventDefault();
  };

  const onSelectStart = (e: Event) => {
    if (movedInTask) e.preventDefault();
  };

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", finishGesture);
  handle.addEventListener("pointercancel", onPointerCancel);
  handle.addEventListener("lostpointercapture", onLostCapture);
  handle.addEventListener("dragstart", onNativeDrag);
  const page = handle.ownerDocument;
  const selectScopes = [handle.getRootNode(), page];
  for (const scope of selectScopes) {
    scope.addEventListener("selectstart", onSelectStart);
  }
  for (const type of PAGE_POINTER_EVENTS) {
    page.addEventListener(type, onPagePointer, true);
  }
  const managesTouchAction = options.manageTouchAction !== false;
  const prevTouchAction = handle.style.touchAction;
  if (managesTouchAction) {
    handle.style.touchAction = isAxisVertical(mode) ? "pan-x" : "pan-y";
  }

  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", finishGesture);
    handle.removeEventListener("pointercancel", onPointerCancel);
    handle.removeEventListener("lostpointercapture", onLostCapture);
    handle.removeEventListener("dragstart", onNativeDrag);
    for (const scope of selectScopes) {
      scope.removeEventListener("selectstart", onSelectStart);
    }
    for (const type of PAGE_POINTER_EVENTS) {
      page.removeEventListener(type, onPagePointer, true);
    }
    if (managesTouchAction) handle.style.touchAction = prevTouchAction;
    if (activePointerId !== null && handle.hasPointerCapture(activePointerId)) {
      handle.releasePointerCapture(activePointerId);
    }
  };
};
