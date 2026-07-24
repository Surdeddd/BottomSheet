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
  /** Rejects a pointerdown outright — used for drag zones. */
  shouldStart?: (e: PointerEvent) => boolean;
  /**
   * Postpones the gesture to the first move: `true` starts it, `false` hands the
   * pointer back to the browser, `null` waits for more movement.
   */
  deferStart?: (e: PointerEvent, delta: number) => boolean | null;
  /** Scroll containers must keep their own touch-action. */
  manageTouchAction?: boolean;
};

const isAxisVertical = (mode: SheetMode) => mode === "bottom" || mode === "top";

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
  let lastCoord = 0;
  let pendingStart = false;
  const VELOCITY_WINDOW_MS = (kind: PointerKind) =>
    kind === "mouse" ? 160 : 120;
  const MAX_SAMPLES = 32;
  const samples = new SampleRing(MAX_SAMPLES);

  const axis = isAxisVertical(mode) ? "Y" : "X";
  const sign = mode === "bottom" || mode === "right" ? -1 : 1;

  const coordOf = (e: PointerEvent): number =>
    axis === "Y" ? e.clientY : e.clientX;

  const capture = (pointerId: number): void => {
    try {
      handle.setPointerCapture(pointerId);
    } catch {
    }
  };

  const releaseTracking = (): void => {
    activePointerId = null;
    pendingStart = false;
    samples.reset();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (activePointerId !== null) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (options.shouldStart && !options.shouldStart(e)) return;
    activePointerId = e.pointerId;
    activePointerType =
      (e.pointerType as PointerKind) || "touch";
    startCoord = coordOf(e);
    lastCoord = startCoord;
    samples.reset();
    samples.push(e.timeStamp, startCoord);
    if (options.deferStart) {
      pendingStart = true;
      return;
    }
    capture(e.pointerId);
    callbacks.onStart(startCoord, activePointerType);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    const coord = coordOf(e);
    const rawDelta = coord - startCoord;
    const delta = rawDelta * sign;
    if (pendingStart) {
      const verdict = options.deferStart!(e, delta);
      if (verdict === false) {
        releaseTracking();
        return;
      }
      if (verdict !== true) return;
      pendingStart = false;
      // Restart from where the finger is now, so the sheet does not jump by the slop.
      startCoord = coord;
      lastCoord = coord;
      samples.reset();
      samples.push(e.timeStamp, coord);
      capture(e.pointerId);
      callbacks.onStart(startCoord, activePointerType);
      return;
    }
    lastCoord = coord;
    samples.push(e.timeStamp, coord);
    const cutoff = e.timeStamp - VELOCITY_WINDOW_MS(activePointerType);
    samples.pruneBefore(cutoff, 2);
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
    if (samples.length >= 3) {
      const first = samples.oldest()!;
      const last = samples.newest()!;
      const dt = last.t - first.t;
      if (dt > 0) velocity = ((last.v - first.v) / dt) * sign;
    }
    const finishedKind = activePointerType;
    activePointerId = null;
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

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", finishGesture);
  handle.addEventListener("pointercancel", onPointerCancel);
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
    if (managesTouchAction) handle.style.touchAction = prevTouchAction;
    if (activePointerId !== null && handle.hasPointerCapture(activePointerId)) {
      handle.releasePointerCapture(activePointerId);
    }
  };
};

export const attachGestures = installGestures;
