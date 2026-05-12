import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import {
  OPACITY_WRITE_EPSILON,
  POINTER_EVENTS_OPACITY_THRESHOLD,
  SIZE_WRITE_EPSILON,
} from "../../src/core/primitives/hot-path-thresholds";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { makeDom } from "./_helpers/makeDom";

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
    it(`skips --bs-size CSSOM write when delta is below ${SIZE_WRITE_EPSILON}px`, async () => {
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
      const setProperty = vi.spyOn(sheet.style, "setProperty");

      await engine.dragTo(500.3);
      const sizeWritesAfterTinyDelta = setProperty.mock.calls.filter(
        c => c[0] === "--bs-size",
      ).length;
      expect(sizeWritesAfterTinyDelta).toBe(0);

      await engine.dragTo(502);
      const sizeWritesAfterRealDelta = setProperty.mock.calls.filter(
        c => c[0] === "--bs-size",
      ).length;
      expect(sizeWritesAfterRealDelta).toBeGreaterThan(0);

      setProperty.mockRestore();
      engine.destroy();
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
