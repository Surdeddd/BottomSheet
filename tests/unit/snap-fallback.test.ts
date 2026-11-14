import { beforeEach, describe, expect, it } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import type { EngineOptions } from "../../src/core/types";
import { makeDom } from "./_helpers/makeDom";

const POINTS: EngineOptions["snapPoints"] = [
  { id: "closed", size: 0 },
  { id: "peek", size: 120 },
  { id: "half", size: 300 },
  { id: "full", size: 500 },
];

const settle = (): Promise<void> => new Promise(r => setTimeout(r, 30));

const make = (options: Partial<EngineOptions> = {}): BottomSheetEngine => {
  const { sheet, handle, content } = makeDom();
  return new BottomSheetEngine({
    element: sheet,
    handle,
    scrollContainer: content,
    snapPoints: POINTS,
    initial: "half",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
    ...options,
  });
};

describe("the snap an open sheet falls back to", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("setSnapPoints keeps an open sheet open at the nearest new point", async () => {
    const engine = make();
    engine.setSnapPoints([
      { id: "closed", size: 0 },
      { id: "low", size: 100 },
      { id: "high", size: 400 },
    ]);
    await settle();
    expect(engine.state.activeId).toBe("high");
    expect(engine.state.size).toBe(400);
    expect(engine.state.phase).toBe("open");
    engine.destroy();
  });

  it("setSnapPoints never closes an open sheet while an open point is left", async () => {
    const engine = make({ initial: "peek" });
    engine.setSnapPoints([
      { id: "closed", size: 0 },
      { id: "big", size: 600 },
    ]);
    await settle();
    expect(engine.state.activeId).toBe("big");
    expect(engine.state.phase).toBe("open");
    engine.destroy();
  });

  it("setSnapPoints keeps a closed sheet closed when the closed point is renamed", async () => {
    const engine = make({ initial: "closed" });
    engine.setSnapPoints([
      { id: "hidden", size: 0 },
      { id: "low", size: 100 },
    ]);
    await settle();
    expect(engine.state.activeId).toBe("hidden");
    expect(engine.state.size).toBe(0);
    expect(engine.state.phase).toBe("closed");
    engine.destroy();
  });

  it("setSnapPoints closes the sheet when only a closed point is left", async () => {
    const engine = make();
    engine.setSnapPoints([{ id: "gone", size: 0 }]);
    await settle();
    expect(engine.state.activeId).toBe("gone");
    expect(engine.state.phase).toBe("closed");
    engine.destroy();
  });

  it("setSnapPoints allows every new point when the old list was unrestricted", async () => {
    const engine = make();
    engine.setSnapPoints([
      { id: "closed", size: 0 },
      { id: "low", size: 100 },
      { id: "high", size: 400 },
    ]);
    await settle();
    expect(engine.getAllowedIds()).toEqual(["closed", "low", "high"]);
    await engine.snapTo("low");
    expect(engine.state.activeId).toBe("low");
    engine.destroy();
  });

  it("setSnapPoints carries a restriction over to the ids that survive", async () => {
    const engine = make({ allowed: ["closed", "half"] });
    engine.setSnapPoints([
      { id: "closed", size: 0 },
      { id: "half", size: 280 },
      { id: "high", size: 400 },
    ]);
    await settle();
    expect(engine.getAllowedIds()).toEqual(["closed", "half"]);
    expect(engine.state.activeId).toBe("half");
    expect(engine.state.size).toBe(280);
    engine.destroy();
  });

  it("setSnapPoints drops a restriction none of whose ids survive", async () => {
    const engine = make({ allowed: ["peek", "half"] });
    engine.setSnapPoints([
      { id: "closed", size: 0 },
      { id: "low", size: 100 },
      { id: "high", size: 400 },
    ]);
    await settle();
    expect(engine.getAllowedIds()).toEqual(["closed", "low", "high"]);
    expect(engine.state.activeId).toBe("high");
    engine.destroy();
  });

  it("setAllowed keeps an open sheet open at the nearest allowed point", async () => {
    const engine = make();
    engine.setAllowed(["closed", "peek", "full"]);
    await settle();
    expect(engine.state.activeId).toBe("peek");
    expect(engine.state.phase).toBe("open");
    engine.destroy();
  });

  it("setAllowed picks by distance, not by the order of the list", async () => {
    const engine = make({ initial: "full" });
    engine.setAllowed(["closed", "peek", "half"]);
    await settle();
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("setAllowed still honours the snap it is given", async () => {
    const engine = make();
    engine.setAllowed(["closed", "peek", "full"], "full");
    await settle();
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });

  it("setAllowed closes the sheet when nothing open is allowed", async () => {
    const engine = make();
    engine.setAllowed(["closed"]);
    await settle();
    expect(engine.state.activeId).toBe("closed");
    expect(engine.state.phase).toBe("closed");
    engine.destroy();
  });

  it("disableClose keeps the sheet where it is when nothing open is allowed", async () => {
    const engine = make({ disableClose: true });
    engine.setAllowed(["closed"]);
    await settle();
    expect(engine.state.activeId).toBe("half");
    expect(engine.state.phase).toBe("open");
    engine.destroy();
  });
});
