import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installAutoCollapse,
  type AutoCollapseDeps,
} from "../../src/core/features/auto-collapse";

const SIZES: Record<string, number> = { closed: 0, min: 100, full: 800 };

const make = (overrides: Partial<AutoCollapseDeps> = {}) => {
  const snapTo = vi.fn();
  const listeners: Array<() => void> = [];
  const detach = installAutoCollapse({
    ms: 200,
    isDestroyed: () => false,
    isDragging: () => false,
    isAnimating: () => false,
    getAllowedIds: () => ["closed", "min", "full"],
    getActiveId: () => "full",
    resolveSnap: id => ({ id, size: SIZES[id] ?? 0 }),
    snapTo,
    on: (_event, fn) => {
      listeners.push(fn as () => void);
      return () => {};
    },
    ...overrides,
  });
  return { snapTo, detach, emitSnap: () => listeners.forEach(fn => fn()) };
};

describe("auto-collapse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses an idle sheet to its smallest open snap", () => {
    const { snapTo, detach } = make();
    vi.advanceTimersByTime(199);
    expect(snapTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(snapTo).toHaveBeenCalledWith("min");
    detach();
  });

  it("leaves a sheet that is mid-transition alone and waits again", () => {
    let animating = true;
    const { snapTo, detach } = make({ isAnimating: () => animating });
    vi.advanceTimersByTime(200);
    expect(snapTo).not.toHaveBeenCalled();

    animating = false;
    vi.advanceTimersByTime(199);
    expect(snapTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(snapTo).toHaveBeenCalledWith("min");
    detach();
  });

  it("leaves a sheet that is being dragged alone and waits again", () => {
    let dragging = true;
    const { snapTo, detach } = make({ isDragging: () => dragging });
    vi.advanceTimersByTime(200);
    expect(snapTo).not.toHaveBeenCalled();

    dragging = false;
    vi.advanceTimersByTime(200);
    expect(snapTo).toHaveBeenCalledWith("min");
    detach();
  });

  it("starts the wait over on every snap", () => {
    const { snapTo, detach, emitSnap } = make();
    vi.advanceTimersByTime(150);
    emitSnap();
    vi.advanceTimersByTime(150);
    expect(snapTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(snapTo).toHaveBeenCalledWith("min");
    detach();
  });

  it("does nothing for a closed sheet or one already at its smallest snap", () => {
    const closed = make({ getActiveId: () => "closed" });
    const lowest = make({ getActiveId: () => "min" });
    vi.advanceTimersByTime(500);
    expect(closed.snapTo).not.toHaveBeenCalled();
    expect(lowest.snapTo).not.toHaveBeenCalled();
    closed.detach();
    lowest.detach();
  });

  it("stops waiting once it is torn down", () => {
    const { snapTo, detach } = make();
    detach();
    vi.advanceTimersByTime(500);
    expect(snapTo).not.toHaveBeenCalled();
  });

  it("is off without a positive delay", () => {
    const { snapTo } = make({ ms: 0 });
    vi.advanceTimersByTime(500);
    expect(snapTo).not.toHaveBeenCalled();
  });
});
