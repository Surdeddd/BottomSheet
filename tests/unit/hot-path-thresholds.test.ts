import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import {
  OPACITY_WRITE_EPSILON,
  POINTER_EVENTS_OPACITY_THRESHOLD,
  SIZE_WRITE_EPSILON,
} from "../../src/core/primitives/hot-path-thresholds";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { makeDom } from "./_helpers/makeDom";
import { easeOutCubic } from "../../src/core/animation/animation";
import { AnimationRunner } from "../../src/core/controllers/animation-runner";

describe("Hot-path threshold regressions", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  describe("--bs-size write dedup (SIZE_WRITE_EPSILON)", () => {
    const sizeWrites = (spy: { mock: { calls: unknown[][] } }): number =>
      spy.mock.calls.filter(c => c[0] === "--bs-size").length;

    it(`skips a --bs-size write for a drag step below ${SIZE_WRITE_EPSILON}px`, () => {
      const { sheet, handle } = makeDom();
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        snapPoints: [
          { id: "a", size: 100 },
          { id: "b", size: 800 },
        ],
        initial: "a",
        animation: "tween",
        duration: 0,
        respectReducedMotion: false,
      });
      const move = (type: string, clientY: number): void => {
        handle.dispatchEvent(
          new PointerEvent(type, { clientY, pointerId: 1, button: 0 }),
        );
      };

      move("pointerdown", 600);
      move("pointermove", 500);
      const setProperty = vi.spyOn(sheet.style, "setProperty");

      move("pointermove", 499.7);
      expect(sizeWrites(setProperty)).toBe(0);

      move("pointermove", 498);
      expect(sizeWrites(setProperty)).toBeGreaterThan(0);

      move("pointerup", 498);
      setProperty.mockRestore();
      engine.destroy();
    });

    it("writes a sub-pixel size change made while the sheet is at rest", async () => {
      const { sheet, handle } = makeDom();
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        snapPoints: [
          { id: "a", size: 100 },
          { id: "b", size: 800 },
        ],
        initial: "a",
        animation: "tween",
        duration: 0,
        respectReducedMotion: false,
      });

      await engine.dragTo(500);
      await engine.dragTo(500.3);

      expect(sheet.style.getPropertyValue("--bs-size")).toBe("500.3px");
      engine.destroy();
    });

    it("leaves the exact size in --bs-size once an animation ends in sub-pixel steps", async () => {
      const { sheet, handle } = makeDom();
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        snapPoints: [
          { id: "a", size: 400 },
          { id: "b", size: 800 },
        ],
        initial: "a",
        animation: "tween",
        duration: 160,
        easing: easeOutCubic,
        respectReducedMotion: false,
      });
      let queue: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        queue.push(cb);
        return queue.length;
      });
      vi.stubGlobal("cancelAnimationFrame", () => {});

      const done = engine.snapTo("b");
      let now = performance.now();
      for (let i = 0; i < 16; i++) {
        now += 16;
        const batch = queue;
        queue = [];
        for (const cb of batch) cb(now);
      }
      await done;
      vi.unstubAllGlobals();

      expect(engine.state.size).toBe(800);
      expect(sheet.style.getPropertyValue("--bs-size")).toBe("800px");
      engine.destroy();
    });

    it("an animation to the size the sheet already has still commits that size", async () => {
      const applySize = vi.fn();
      const runner = new AnimationRunner(
        {
          element: document.createElement("div"),
          getRootEl: () => null,
          applySize,
          getSize: () => 440,
          isDragging: () => false,
        },
        { animation: "tween", duration: 160, respectReducedMotion: false },
      );

      await runner.animateTo(440, 0);

      expect(applySize).toHaveBeenCalledWith(440);
      runner.destroy();
    });
  });

  describe("--bs-progress write dedup (OPACITY_WRITE_EPSILON)", () => {
    it(`skips --bs-progress CSSOM write when delta is below ${OPACITY_WRITE_EPSILON}`, async () => {
      const { sheet, handle } = makeDom();
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        snapPoints: [
          { id: "min", size: 100 },
          { id: "max", size: 1100 },
        ],
        initial: "min",
        animation: "tween",
        duration: 0,
        respectReducedMotion: false,
      });

      const setProperty = vi.spyOn(sheet.style, "setProperty");

      await engine.dragTo(600);

      const progressWritesBaseline = setProperty.mock.calls.filter(
        c => c[0] === "--bs-progress",
      ).length;

      await engine.dragTo(601);
      const progressWritesAfterTinyDelta = setProperty.mock.calls.filter(
        c => c[0] === "--bs-progress",
      ).length;

      await engine.dragTo(700);
      const progressWritesAfterRealDelta = setProperty.mock.calls.filter(
        c => c[0] === "--bs-progress",
      ).length;

      expect(progressWritesAfterTinyDelta).toBe(progressWritesBaseline);
      expect(progressWritesAfterRealDelta).toBeGreaterThan(
        progressWritesAfterTinyDelta,
      );

      setProperty.mockRestore();
      engine.destroy();
    });
  });

  describe("backdrop pointer-events flip (POINTER_EVENTS_OPACITY_THRESHOLD)", () => {
    it(`flips backdrop pointer-events ↔ none around opacity ${POINTER_EVENTS_OPACITY_THRESHOLD}`, async () => {
      const { sheet, handle } = makeDom();
      const backdrop = document.createElement("div");
      document.body.appendChild(backdrop);

      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        backdrop,
        snapPoints: [
          { id: "closed", size: 0 },
          { id: "open", size: 1000 },
        ],
        initial: "closed",
        animation: "tween",
        duration: 0,
        respectReducedMotion: false,
      });

      expect(backdrop.style.pointerEvents).toBe("none");

      await engine.dragTo(500);
      expect(backdrop.style.pointerEvents).toBe("auto");

      await engine.dragTo(40);
      expect(backdrop.style.pointerEvents).toBe("none");

      await engine.dragTo(60);
      expect(backdrop.style.pointerEvents).toBe("auto");

      backdrop.remove();
      engine.destroy();
    });
  });
});
