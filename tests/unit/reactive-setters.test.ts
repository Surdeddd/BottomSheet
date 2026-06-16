import { describe, expect, it, beforeEach } from "vitest";
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

const makeScreen = (): HTMLElement => {
  const screen = document.createElement("div");
  document.body.appendChild(screen);
  return screen;
};

const setSize = (engine: BottomSheetEngine, size: number): void => {
  (engine as unknown as { applySize: (n: number) => void }).applySize(size);
};

const getMaxAxisSize = (engine: BottomSheetEngine): number =>
  (engine as unknown as { snaps: { getMaxAxisSize: () => number } }).snaps.getMaxAxisSize();

describe("reactive setters — setScrimColor", () => {
  beforeEach(() => resetGlobals());

  it("updates the scrim background on the screen component", () => {
    const { sheet, handle } = makeDom();
    const screen = makeScreen();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setScrimColor("rgba(0,0,0,0.7)");
    expect(screen.style.background).toContain("rgba(0, 0, 0, 0.7)");
    engine.destroy();
  });

  it("clears the inline background when passed null", () => {
    const { sheet, handle } = makeDom();
    const screen = makeScreen();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setScrimColor("#123456");
    expect(screen.style.background).toBe("#123456");
    engine.setScrimColor(null);
    expect(screen.style.background).toBe("");
    engine.destroy();
  });
});

describe("reactive setters — setBackdropRange", () => {
  beforeEach(() => resetGlobals());

  it("updates backdrop opacity behavior: 0 before the new start, ramps after", () => {
    const { sheet, handle, backdrop } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "min",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setBackdropRange([0.5, 1]);
    setSize(engine, 400);
    expect(parseFloat(backdrop.style.opacity || "0")).toBeCloseTo(0, 2);
    setSize(engine, 750);
    expect(parseFloat(backdrop.style.opacity)).toBeCloseTo(0.5, 2);
    engine.destroy();
  });
});

describe("reactive setters — setRadius", () => {
  beforeEach(() => resetGlobals());

  it("sets --bs-radius with px when given a number", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setRadius(24);
    expect(sheet.style.getPropertyValue("--bs-radius")).toBe("24px");
    engine.destroy();
  });

  it("sets --bs-radius verbatim when given a string", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setRadius("1.5rem");
    expect(sheet.style.getPropertyValue("--bs-radius")).toBe("1.5rem");
    engine.destroy();
  });
});

describe("reactive setters — setMaxHeight", () => {
  beforeEach(() => resetGlobals());

  it("clamps maxAxisSize down to a numeric cap", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(getMaxAxisSize(engine)).toBe(800);
    engine.setMaxHeight(500);
    expect(getMaxAxisSize(engine)).toBe(500);
    engine.destroy();
  });

  it("clamps the current size down when it exceeds the new cap", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.snapTo("full");
    expect(engine.state.size).toBe(800);
    engine.setMaxHeight(400);
    expect(engine.state.size).toBe(400);
    engine.destroy();
  });

  it("leaves size untouched when below the new cap", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.snapTo("min");
    engine.setMaxHeight(500);
    expect(engine.state.size).toBe(100);
    expect(getMaxAxisSize(engine)).toBe(500);
    engine.destroy();
  });
});
