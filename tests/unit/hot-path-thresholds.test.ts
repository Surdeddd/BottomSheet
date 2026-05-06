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

/**
 * Hot-path CSSOM-write dedup is a performance invariant: dragging at 120 Hz
 * fires applySize ~120×/s, and the spring's settle tail can produce many
 * sub-pixel deltas. Writing every one would burn 30-50% of frame budget on
 * style-recalc work that's below human perception. These tests guard the
 * thresholds defined in `primitives/hot-path-thresholds.ts` against silent
 * regressions — e.g. someone refactoring applySize and dropping the gates.
 */
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
      // Wide range so dragTo targets stay well clear of the upper rail
      // (where rubber-band / clamp would mask the dedup behavior).
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

      // Establish a known mid-range baseline first, BEFORE spying — so the
      // spy starts with a clean baseline and we measure only the deltas that
      // matter for the dedup gate.
      await engine.dragTo(500);
      const setProperty = vi.spyOn(sheet.style, "setProperty");

      // Sub-epsilon: 500 → 500.3 (delta 0.3px < 0.5).
      await engine.dragTo(500.3);
      const sizeWritesAfterTinyDelta = setProperty.mock.calls.filter(
        c => c[0] === "--bs-size",
      ).length;
      expect(sizeWritesAfterTinyDelta).toBe(0);

      // Above-epsilon: 500 → 502 (delta 2px > 0.5).
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
      // Range 100..1100: each pixel of size = 0.001 progress, so a 1px size
      // delta = exactly OPACITY_WRITE_EPSILON 0.005 / 5 = sub-epsilon.
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

      // Force a deterministic baseline write for `--bs-progress`.
      await engine.dragTo(600);

      const progressWritesBaseline = setProperty.mock.calls.filter(
        c => c[0] === "--bs-progress",
      ).length;

      // Sub-epsilon: progress delta ≈ 0.001 (below 0.005). Size delta of 1px
      // also exceeds SIZE_WRITE_EPSILON so the size branch may write — we're
      // only asserting the progress branch dedups.
      await engine.dragTo(601);
      const progressWritesAfterTinyDelta = setProperty.mock.calls.filter(
        c => c[0] === "--bs-progress",
      ).length;

      // Above-epsilon: 600 → 700 = 0.1 progress delta.
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

      // Closed → backdrop opacity 0 → pointer-events: none.
      expect(backdrop.style.pointerEvents).toBe("none");

      // Mid-open: opacity well above threshold → pointer-events: auto.
      await engine.dragTo(500);
      expect(backdrop.style.pointerEvents).toBe("auto");

      // Just below threshold: opacity ≈ 0.04 (size 40 / max 1000).
      await engine.dragTo(40);
      expect(backdrop.style.pointerEvents).toBe("none");

      // Just above threshold: opacity ≈ 0.06 (size 60 / max 1000).
      await engine.dragTo(60);
      expect(backdrop.style.pointerEvents).toBe("auto");

      backdrop.remove();
      engine.destroy();
    });
  });
});
