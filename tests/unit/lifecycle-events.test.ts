import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";
import { makeDom } from "./_helpers/makeDom";

const resetGlobals = () => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  __resetRouteCoordinatorForTests();
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
};

describe("BottomSheetEngine — before-close (cancelable)", () => {
  beforeEach(() => resetGlobals());

  it("aborts the close when a listener calls cancel()", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.on("before-close", e => e.cancel());
    await engine.close();
    expect(engine.state.activeId).toBe("full");
    expect(engine.state.size).toBe(800);
    engine.destroy();
  });

  it("proceeds with the close when no listener cancels", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onBeforeClose = vi.fn();
    engine.on("before-close", onBeforeClose);
    await engine.close();
    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(engine.state.activeId).toBe("closed");
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });

  it("fires synchronously before the close proceeds, with the given reason", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const reasons: string[] = [];
    let sizeAtEmit = -1;
    engine.on("before-close", e => {
      reasons.push(e.reason);
      sizeAtEmit = engine.state.size;
    });
    await engine.close("escape");
    expect(reasons).toEqual(["escape"]);
    expect(sizeAtEmit).toBe(800);
    engine.destroy();
  });

  it("defaults the reason to 'programmatic'", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    let reason = "";
    engine.on("before-close", e => {
      reason = e.reason;
    });
    await engine.close();
    expect(reason).toBe("programmatic");
    engine.destroy();
  });
});

describe("BottomSheetEngine — opened/closed lifecycle events", () => {
  beforeEach(() => resetGlobals());

  it("emits 'opened' after the open enter animation settles", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const order: string[] = [];
    let sizeAtOpened = -1;
    engine.on("open", () => order.push("open"));
    engine.on("opened", e => {
      order.push(`opened:${e.id}`);
      sizeAtOpened = engine.state.size;
    });
    await engine.open("full");
    expect(order).toEqual(["open", "opened:full"]);
    expect(sizeAtOpened).toBe(800);
    engine.destroy();
  });

  it("emits 'closed' after the close exit animation settles (size === 0)", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const order: string[] = [];
    let sizeAtClosed = -1;
    engine.on("close", () => order.push("close"));
    engine.on("closed", () => {
      order.push("closed");
      sizeAtClosed = engine.state.size;
    });
    await engine.close();
    expect(order).toEqual(["close", "closed"]);
    expect(sizeAtClosed).toBe(0);
    engine.destroy();
  });

  it("does not emit 'opened' or 'closed' on a same-state snap between non-zero ids", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onOpened = vi.fn();
    const onClosed = vi.fn();
    engine.on("opened", onOpened);
    engine.on("closed", onClosed);
    await engine.snapTo("full");
    expect(onOpened).not.toHaveBeenCalled();
    expect(onClosed).not.toHaveBeenCalled();
    engine.destroy();
  });
});

describe("BottomSheetEngine — snap payload shape", () => {
  beforeEach(() => resetGlobals());

  it("includes { id, size, progress } on snap", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const payloads: { id: string; size: number; progress: number }[] = [];
    engine.on("snap", p => payloads.push(p));
    await engine.snapTo("full");
    const last = payloads[payloads.length - 1];
    expect(last).toBeDefined();
    expect(last?.id).toBe("full");
    expect(last?.size).toBe(1000);
    expect(typeof last?.progress).toBe("number");
    expect(last?.progress).toBeCloseTo(1, 2);
    engine.destroy();
  });

  it("progress is 0 at the closed snap", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    let progressAtClose = -1;
    engine.on("snap", p => {
      if (p.id === "closed") progressAtClose = p.progress;
    });
    await engine.close();
    expect(progressAtClose).toBeCloseTo(0, 2);
    engine.destroy();
  });
});
