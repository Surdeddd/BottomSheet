import { beforeEach, describe, expect, it } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import type { EngineOptions } from "../../src/core/types";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { makeDom } from "./_helpers/makeDom";

const mount = (snapPoints: EngineOptions["snapPoints"], initial: string) => {
  const { sheet, handle, content } = makeDom();
  const engine = new BottomSheetEngine({
    element: sheet,
    handle,
    scrollContainer: content,
    snapPoints,
    initial,
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
  });
  return { engine, handle };
};

describe("names of the snap points for a screen reader", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("reads the label of the active point on the handle", async () => {
    const { engine, handle } = mount(
      [
        { id: "peek", size: 120, label: "Свёрнута" },
        { id: "full", size: 700, label: "Развёрнута" },
      ],
      "peek",
    );

    expect(handle.getAttribute("aria-valuetext")).toBe("Свёрнута");
    await engine.snapTo("full");
    expect(handle.getAttribute("aria-valuetext")).toBe("Развёрнута");
    engine.destroy();
  });

  it("falls back to the id of a point that has no label", async () => {
    const { engine, handle } = mount(
      [
        { id: "peek", size: 120 },
        { id: "full", size: 700, label: "Expanded" },
      ],
      "peek",
    );

    expect(handle.getAttribute("aria-valuetext")).toBe("peek");
    expect(engine.state.activeLabel).toBe("peek");
    await engine.snapTo("full");
    expect(engine.state.activeLabel).toBe("Expanded");
    engine.destroy();
  });

  it("follows the labels of points replaced on a live sheet", () => {
    const { engine, handle } = mount([{ id: "peek", size: 120 }], "peek");

    engine.setSnapPoints([{ id: "peek", size: 120, label: "Collapsed" }]);

    expect(handle.getAttribute("aria-valuetext")).toBe("Collapsed");
    expect(engine.state.activeLabel).toBe("Collapsed");
    engine.destroy();
  });
});
