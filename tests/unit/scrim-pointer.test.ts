import { beforeEach, describe, expect, it } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import type { EngineOptions } from "../../src/core/types";
import { makeDom } from "./_helpers/makeDom";

const make = (options: Partial<EngineOptions> = {}) => {
  const { sheet, handle } = makeDom();
  const scrim = document.createElement("div");
  document.body.appendChild(scrim);
  const engine = new BottomSheetEngine({
    element: sheet,
    handle,
    scrim,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: 400 },
      { id: "full", size: 800 },
    ],
    initial: "half",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
    ...options,
  });
  return { engine, scrim };
};

describe("pointer input on the scrim", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("a plain scrim lets pointer input through", () => {
    const { engine, scrim } = make();
    expect(scrim.style.pointerEvents).toBe("none");
    engine.destroy();
  });

  it("tap-to-close switched on and off at runtime gives the page back", () => {
    const { engine, scrim } = make();
    engine.setScrimTapToClose(true);
    expect(scrim.style.pointerEvents).toBe("auto");
    engine.setScrimTapToClose(false);
    expect(scrim.style.pointerEvents).toBe("none");
    engine.destroy();
  });

  it("tap-to-close set as an option gives the page back once switched off", () => {
    const { engine, scrim } = make({ scrimTapToClose: true });
    expect(scrim.style.pointerEvents).toBe("auto");
    engine.setScrimTapToClose(false);
    expect(scrim.style.pointerEvents).toBe("none");
    engine.destroy();
  });

  it("an interactive scrim stays interactive when tap-to-close goes off", () => {
    const { engine, scrim } = make({
      scrimInteractive: true,
      scrimTapToClose: true,
    });
    engine.setScrimTapToClose(false);
    expect(scrim.style.pointerEvents).toBe("auto");
    engine.destroy();
  });

  it("tap-to-close keeps working when interactivity is switched off", async () => {
    const { engine, scrim } = make({ scrimTapToClose: true });
    engine.setScrimInteractive(false);
    expect(scrim.style.pointerEvents).toBe("auto");
    scrim.dispatchEvent(new Event("click", { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });

  it("tap-to-close survives a round trip through the above-sheet mode", () => {
    const { engine, scrim } = make({ scrimTapToClose: true });
    engine.setScrimMode("above-sheet");
    expect(scrim.style.pointerEvents).toBe("auto");
    engine.setScrimMode("full");
    expect(scrim.style.pointerEvents).toBe("auto");
    engine.destroy();
  });

  it("a plain scrim is click-through again after the above-sheet mode", () => {
    const { engine, scrim } = make({ scrimMode: "above-sheet" });
    expect(scrim.style.pointerEvents).toBe("none");
    engine.setScrimMode("full");
    expect(scrim.style.pointerEvents).toBe("none");
    engine.destroy();
  });

  it("setScrim applies tap-to-close and interactivity together", () => {
    const { engine, scrim } = make();
    engine.setScrim({ tapToClose: true, interactive: false });
    expect(scrim.style.pointerEvents).toBe("auto");
    engine.setScrim({ tapToClose: false });
    expect(scrim.style.pointerEvents).toBe("none");
    engine.destroy();
  });
});
