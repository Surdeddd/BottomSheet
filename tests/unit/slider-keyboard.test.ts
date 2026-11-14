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

describe("arrow keys on the handle", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, "innerWidth", {
      value: 1000,
      configurable: true,
    });
  });

  const cases = [
    ["bottom", "ArrowUp", "ArrowDown"],
    ["top", "ArrowDown", "ArrowUp"],
    ["left", "ArrowRight", "ArrowLeft"],
    ["right", "ArrowLeft", "ArrowRight"],
  ] as const;

  for (const [mode, grow, shrink] of cases) {
    it(`${mode}: ${grow} grows the sheet, ${shrink} shrinks it`, async () => {
      const { sheet, handle, content } = makeDom();
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        scrollContainer: content,
        snapPoints: POINTS,
        initial: "half",
        mode,
        animation: "tween",
        duration: 0,
        respectReducedMotion: false,
      });
      const press = (key: string): boolean =>
        handle.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        );

      expect(press(grow)).toBe(false);
      await settle();
      expect(engine.state.activeId).toBe("full");

      press(shrink);
      await settle();
      expect(engine.state.activeId).toBe("half");
      engine.destroy();
    });
  }
});
