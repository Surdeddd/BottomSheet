import type { SheetMode } from "./types";

export type PointerSample = { t: number; v: number };
export type PointerKind = "touch" | "mouse" | "pen";

export type GestureCallbacks = {
  onStart: (axisCoord: number, pointerType: PointerKind) => void;
  onMove: (delta: number) => void;
  onEnd: (delta: number, velocity: number, pointerType: PointerKind) => void;
  onCancel?: () => void;
};

const isAxisVertical = (mode: SheetMode) => mode === "bottom" || mode === "top";

/**
 * Fixed-capacity ring buffer of {t,v} samples. Pre-allocates all slots so
 * `push` never produces garbage during a drag — relevant on low-end Android
 * where 120 short-lived objects/sec for several seconds creates noticeable
 * GC pause risk during the gesture.
 */
class SampleRing {
  private readonly slots: PointerSample[];
  private readonly capacity: number;
  private head = 0; // next write index
  private size = 0; // current count, ≤ capacity

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

  /**
   * Drop oldest entries whose timestamp is below `cutoff`, but never shrink
   * below `minKeep`. Mirrors the original
   *   `while (samples.length > minKeep && samples[0].t < cutoff) samples.shift()`
   * but without copying — just advances the logical tail.
   */
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

/**
 * Pointer Events handler with velocity tracking. Listens on `handle` for the
 * initial press, then captures the pointer so movement outside the element is
 * still tracked. Multi-touch is ignored: only the first pointer drives the gesture.
 *
 * Velocity is computed from the last ~80ms of samples for stable flick detection.
 */
export const installGestures = (
  handle: HTMLElement,
  mode: SheetMode,
  callbacks: GestureCallbacks,
): (() => void) => {
  let activePointerId: number | null = null;
  let activePointerType: PointerKind = "touch";
  let startCoord = 0;
  let lastCoord = 0;
  // Pointer-type-tuned velocity window. Mouse pointers (especially trackpad
  // inertia) carry low-velocity sustained motion — needs a longer look-back.
  // Touch flicks are punchier and benefit from a tighter window.
  const VELOCITY_WINDOW_MS = (kind: PointerKind) =>
    kind === "mouse" ? 160 : 120;
  // Ring capacity: at 120Hz with the longest (160ms mouse) window we collect
  // ~20 samples. 32 leaves headroom for super-sampled pointers without ever
  // allocating during a drag.
  const MAX_SAMPLES = 32;
  const samples = new SampleRing(MAX_SAMPLES);

  const axis = isAxisVertical(mode) ? "Y" : "X";
  const sign = mode === "bottom" || mode === "right" ? -1 : 1;

  const coordOf = (e: PointerEvent): number =>
    axis === "Y" ? e.clientY : e.clientX;

  const onPointerDown = (e: PointerEvent) => {
    if (activePointerId !== null) return;
    if (e.button !== undefined && e.button !== 0) return; // ignore right/middle click
    activePointerId = e.pointerId;
    activePointerType =
      (e.pointerType as PointerKind) || "touch";
    startCoord = coordOf(e);
    lastCoord = startCoord;
    samples.reset();
    samples.push(e.timeStamp, startCoord);
    // iOS WebKit < 14.5 silently drops capture if the touched element
    // re-renders. Wrap so a capture failure doesn't crash the gesture.
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* ignore — gesture still works without capture */
    }
    callbacks.onStart(startCoord, activePointerType);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    const coord = coordOf(e);
    const rawDelta = coord - startCoord;
    const delta = rawDelta * sign;
    lastCoord = coord;
    samples.push(e.timeStamp, coord);
    const cutoff = e.timeStamp - VELOCITY_WINDOW_MS(activePointerType);
    samples.pruneBefore(cutoff, 2);
    // No MAX_SAMPLES guard needed: the ring overwrites the oldest slot once
    // capacity is reached, which matches the prior `samples.shift()` behavior.
    callbacks.onMove(delta);
  };

  const finishGesture = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    const rawDelta = lastCoord - startCoord;
    const delta = rawDelta * sign;
    let velocity = 0;
    // Require at least 3 samples for a stable velocity reading — a single
    // stutter on low-end Android pushes 2-sample velocity to ~0.
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
      /* ignore */
    }
    callbacks.onEnd(delta, velocity, finishedKind);
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    samples.reset();
    callbacks.onCancel?.();
  };

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", finishGesture);
  handle.addEventListener("pointercancel", onPointerCancel);
  handle.style.touchAction = isAxisVertical(mode) ? "pan-x" : "pan-y";

  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", finishGesture);
    handle.removeEventListener("pointercancel", onPointerCancel);
    if (activePointerId !== null && handle.hasPointerCapture(activePointerId)) {
      handle.releasePointerCapture(activePointerId);
    }
  };
};

/**
 * @deprecated Renamed to `installGestures` for naming consistency with the
 * other `installX` feature factories. Will be removed in v2 — see
 * `docs/migration-v2.md`.
 */
export const attachGestures = installGestures;
