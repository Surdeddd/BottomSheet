import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { makeDom } from "./_helpers/makeDom";

describe("BottomSheetEngine", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("starts at the configured initial snap", () => {
    const { sheet, handle, content } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "half", size: "50%" },
        { id: "full", size: "80%" },
      ],
      initial: "half",
    });
    expect(engine.state.activeId).toBe("half");
    expect(engine.state.size).toBe(500);
    engine.destroy();
  });

  it("computes progress within the allowed range", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 0 },
        { id: "b", size: 100 },
        { id: "c", size: 500 },
      ],
      allowed: ["a", "b", "c"],
      initial: "b",
      respectReducedMotion: false,
    });
    expect(engine.state.progress).toBe(0.2); // 100 / 500
    engine.destroy();
  });

  it("emits snap event on programmatic snapTo", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onSnap = vi.fn();
    engine.on("snap", onSnap);
    await engine.snapTo("b");
    expect(onSnap).toHaveBeenCalledWith({ id: "b", size: 400 });
    engine.destroy();
  });

  it("warns and no-ops when snap id is not allowed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
      ],
      allowed: ["a"],
      respectReducedMotion: false,
      animation: "tween",
      duration: 0,
    });
    await engine.snapTo("b");
    expect(warn).toHaveBeenCalled();
    expect(engine.state.activeId).toBe("a");
    engine.destroy();
    warn.mockRestore();
  });

  it("setAllowed re-snaps when current state is no longer allowed", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
        { id: "c", size: 800 },
      ],
      initial: "b",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setAllowed(["a", "c"]);
    // wait microtask for snapTo to resolve
    await new Promise(r => setTimeout(r, 30));
    expect(engine.state.activeId).toBe("a");
    engine.destroy();
  });

  it("locks body scroll when opened with non-zero initial", () => {
    const { sheet, handle } = makeDom();
    document.body.style.overflow = "";
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "open", size: 200 }],
      initial: "open",
      lockBodyScroll: true,
      respectReducedMotion: false,
    });
    expect(document.body.style.overflow).toBe("hidden");
    engine.destroy();
    expect(document.body.style.overflow).toBe("");
  });

  it("destroy removes all listeners and stops tween", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "a", size: 100 }],
      respectReducedMotion: false,
    });
    expect(() => engine.destroy()).not.toThrow();
  });

  it("destroy() during active drag releases all listeners cleanly", () => {
    // Tests audit #6: drag-cancel mid-flight must not leak listeners or throw
    // when the consumer tears down between pointerdown and pointerup.
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
      ],
      initial: "b",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: 100, pointerId: 1, button: 0 }),
    );
    handle.dispatchEvent(
      new PointerEvent("pointermove", { clientY: 80, pointerId: 1 }),
    );
    expect(() => engine.destroy()).not.toThrow();
    // Subsequent pointer events on the now-detached handle must be no-ops —
    // the destroyed-flag guard short-circuits before any snapTo/animate call.
    expect(() =>
      handle.dispatchEvent(
        new PointerEvent("pointerup", { clientY: 80, pointerId: 1 }),
      ),
    ).not.toThrow();
  });

  it("destroy() during in-flight snapTo() resolves the promise (no hang)", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 600 },
      ],
      initial: "a",
      animation: "tween",
      duration: 50,
      respectReducedMotion: false,
    });
    const snapPromise = engine.snapTo("b");
    engine.destroy();
    // Without C1 + C2 (destroyed flag + cycleNonce guard), this would hang
    // because animateTo's tween is cancelled by destroy() but the post-await
    // continuation still runs against torn-down state.
    await Promise.race([
      snapPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("snap hung")), 500)),
    ]);
  });

  it("snapTo accepts an AbortSignal that cancels the in-flight animation", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 600 },
      ],
      initial: "a",
      animation: "tween",
      duration: 200,
      respectReducedMotion: false,
    });
    const onSnap = vi.fn();
    engine.on("snap", onSnap);

    const ctl = new AbortController();
    const inFlight = engine.snapTo("b", { signal: ctl.signal });
    // Yield once so animateTo's first rAF lands and isAnimating flips on.
    await Promise.resolve();
    expect(engine.state.isAnimating).toBe(true);
    ctl.abort();

    await inFlight;
    // Aborted snap MUST NOT emit "snap" — the captured signal in snapTo flips
    // to aborted via newCycle() and the post-await guard short-circuits.
    expect(onSnap).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("snapTo with already-aborted signal returns immediately without side effects", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 600 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onBefore = vi.fn();
    const onSnap = vi.fn();
    engine.on("before-snap", onBefore);
    engine.on("snap", onSnap);

    const ctl = new AbortController();
    ctl.abort();
    await engine.snapTo("b", { signal: ctl.signal });

    // Pre-aborted signal short-circuits before before-snap fires — matches
    // standard AbortController contract (no listener observes a stale call).
    expect(onBefore).not.toHaveBeenCalled();
    expect(onSnap).not.toHaveBeenCalled();
    expect(engine.state.activeId).toBe("a");
    engine.destroy();
  });

  it("setSnapPoints() mid-flight cancels prior snap without emitting stale event", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 600 },
      ],
      initial: "a",
      animation: "tween",
      duration: 50,
      respectReducedMotion: false,
    });
    const onSnap = vi.fn();
    engine.on("snap", onSnap);
    // Start a snap to "b" but don't await — replace snap geometry mid-flight.
    const inFlight = engine.snapTo("b");
    engine.setSnapPoints([
      { id: "a", size: 100 },
      { id: "c", size: 400 },
    ]);
    await inFlight;
    // The "b" snap was cancelled by setSnapPoints. Without M3 (cancel + cycle
    // bump), the prior cycle's .then() would fire emit("snap", { id: "b" })
    // even though "b" no longer exists in the new snap geometry.
    const emittedIds = onSnap.mock.calls.map(c => c[0].id);
    expect(emittedIds).not.toContain("b");
    engine.destroy();
  });

  it("orientationchange mid-flight aborts prior snap without emitting stale event", async () => {
    // Covers the AbortController path through onResize (BottomSheetEngine
    // attach() — orientationchange listener calls newCycle() which flips the
    // captured signal to aborted; post-await guard short-circuits emit("snap").
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 600 },
      ],
      initial: "a",
      animation: "tween",
      duration: 50,
      respectReducedMotion: false,
    });
    const onSnap = vi.fn();
    engine.on("snap", onSnap);

    const inFlight = engine.snapTo("b");
    // Yield once so animateTo's first rAF lands and isAnimating flips on —
    // the test premise is "resize during in-flight snap", so lock down that
    // the snap is genuinely in flight before dispatching the orientation
    // change. A future change to animateTo that resolves synchronously when
    // target===current would otherwise turn this assertion into a no-op.
    await Promise.resolve();
    expect(engine.state.isAnimating).toBe(true);

    Object.defineProperty(window, "innerHeight", { value: 500, configurable: true });
    window.dispatchEvent(new Event("orientationchange"));

    await inFlight;

    expect(onSnap).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("visualViewport.resize triggers recompute when keyboard appears", async () => {
    // Mock visualViewport on happy-dom (which doesn't ship one). We re-create
    // it per-test; if the host environment ever provides a real one, this
    // override still applies for the duration of the test.
    type VVListener = (e: Event) => void;
    const vvListeners: Record<string, Set<VVListener>> = { resize: new Set() };
    const fakeVV = {
      height: 1000,
      width: 360,
      addEventListener: (type: string, fn: VVListener) => {
        vvListeners[type] ??= new Set();
        vvListeners[type]!.add(fn);
      },
      removeEventListener: (type: string, fn: VVListener) => {
        vvListeners[type]?.delete(fn);
      },
    };
    const originalVV = (window as any).visualViewport;
    Object.defineProperty(window, "visualViewport", {
      value: fakeVV,
      configurable: true,
    });

    try {
      const { sheet, handle } = makeDom();
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        snapPoints: [
          { id: "min", size: 100 },
          { id: "full", size: 900 },
        ],
        initial: "full",
        animation: "tween",
        duration: 0,
        respectReducedMotion: false,
      });
      expect(engine.state.size).toBe(900);

      // Simulate soft keyboard: visualViewport shrinks to 500px while
      // window.innerHeight stays at 1000px.
      fakeVV.height = 500;
      vvListeners.resize!.forEach(fn => fn(new Event("resize")));
      // Wait one rAF for the throttled handler to fire.
      await new Promise(r => requestAnimationFrame(() => r(undefined)));

      // Sheet should be clamped to visualViewport height minus the safety pad.
      expect(engine.state.size).toBeLessThanOrEqual(500 - 8);
      engine.destroy();
    } finally {
      if (originalVV === undefined) {
        delete (window as any).visualViewport;
      } else {
        Object.defineProperty(window, "visualViewport", {
          value: originalVV,
          configurable: true,
        });
      }
    }
  });

  it("before-snap fires before snapTo and can cancel", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onSnap = vi.fn();
    const onBefore = vi.fn((p: { cancel: () => void; id: string; previousId: string }) => {
      // Listener gates the transition — once cancelled, no animation, no snap event.
      expect(p.id).toBe("b");
      expect(p.previousId).toBe("a");
      p.cancel();
    });
    engine.on("before-snap", onBefore);
    engine.on("snap", onSnap);

    await engine.snapTo("b");

    expect(onBefore).toHaveBeenCalledTimes(1);
    expect(onSnap).not.toHaveBeenCalled();
    expect(engine.state.activeId).toBe("a");
    expect(engine.state.size).toBe(100);
    engine.destroy();
  });

  it("before-snap does NOT cancel when listener is silent", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onBefore = vi.fn();
    const onSnap = vi.fn();
    engine.on("before-snap", onBefore);
    engine.on("snap", onSnap);

    await engine.snapTo("b");

    expect(onBefore).toHaveBeenCalledTimes(1);
    expect(onSnap).toHaveBeenCalledWith({ id: "b", size: 400 });
    expect(engine.state.activeId).toBe("b");
    engine.destroy();
  });

  it("before-snap.cancel() called asynchronously logs warning and is ignored", async () => {
    // Locks down the `frozen` flag contract: cancel() captured into a closure
    // and invoked AFTER the listener returns must be a no-op + console.warn.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    let stashedCancel: (() => void) | undefined;
    const onSnap = vi.fn();
    engine.on("before-snap", p => {
      stashedCancel = p.cancel;
      // Intentionally don't call cancel synchronously — frozen flips to true
      // immediately after this listener returns.
    });
    engine.on("snap", onSnap);

    await engine.snapTo("b");
    expect(onSnap).toHaveBeenCalledTimes(1);

    // Now invoke the captured cancel — frozen=true so it should warn + ignore.
    stashedCancel?.();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      "before-snap.cancel() called asynchronously",
    );

    warnSpy.mockRestore();
    engine.destroy();
  });

  it("respects reduced motion by snapping instantly", async () => {
    const { sheet, handle } = makeDom();
    // Force prefers-reduced-motion to match
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, media: "" } as any);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 500 },
      ],
      initial: "a",
      respectReducedMotion: true,
    });
    await engine.snapTo("b");
    expect(engine.state.size).toBe(500);
    engine.destroy();
  });
});
