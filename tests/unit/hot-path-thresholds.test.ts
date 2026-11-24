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
    const progressWrites = (spy: { mock: { calls: unknown[][] } }): number =>
      spy.mock.calls.filter(c => c[0] === "--bs-progress").length;

    const build = () => {
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
      return { sheet, handle, engine };
    };

    it(`skips a --bs-progress write for a drag step below ${OPACITY_WRITE_EPSILON}`, () => {
      const { sheet, handle, engine } = build();
      const move = (type: string, clientY: number): void => {
        handle.dispatchEvent(
          new PointerEvent(type, { clientY, pointerId: 1, button: 0 }),
        );
      };

      move("pointerdown", 900);
      move("pointermove", 400);
      const setProperty = vi.spyOn(sheet.style, "setProperty");

      move("pointermove", 399);
      expect(progressWrites(setProperty)).toBe(0);

      move("pointermove", 300);
      expect(progressWrites(setProperty)).toBeGreaterThan(0);

      move("pointerup", 300);
      setProperty.mockRestore();
      engine.destroy();
    });

    it("writes a small progress change made while the sheet is at rest", async () => {
      const { sheet, engine } = build();

      await engine.dragTo(600);
      await engine.dragTo(601);

      expect(sheet.style.getPropertyValue("--bs-progress")).toBe("0.501");
      engine.destroy();
    });
  });

  describe("values left behind once the sheet rests", () => {
    const runFrames = async (
      start: () => Promise<unknown>,
      frames: number,
    ): Promise<void> => {
      let queue: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        queue.push(cb);
        return queue.length;
      });
      vi.stubGlobal("cancelAnimationFrame", () => {});
      const done = start();
      let now = performance.now();
      for (let i = 0; i < frames; i++) {
        now += 16;
        const batch = queue;
        queue = [];
        for (const cb of batch) cb(now);
      }
      await done;
      vi.unstubAllGlobals();
    };

    const build = (initial: string, extra: Record<string, unknown> = {}) => {
      const { sheet, handle } = makeDom();
      const backdrop = document.createElement("div");
      const scrim = document.createElement("div");
      document.body.append(backdrop, scrim);
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        backdrop,
        scrim,
        scrimColor: "rgba(0, 0, 0, 0.5)",
        snapPoints: [
          { id: "closed", size: 0 },
          { id: "half", size: 400 },
          { id: "open", size: 800 },
        ],
        initial,
        animation: "tween",
        duration: 320,
        easing: easeOutCubic,
        respectReducedMotion: false,
        ...extra,
      });
      const drop = (): void => {
        engine.destroy();
        backdrop.remove();
        scrim.remove();
      };
      return { engine, sheet, backdrop, scrim, drop };
    };

    it("a close that ends in small steps leaves progress and both dim layers at zero", async () => {
      const { engine, sheet, backdrop, scrim, drop } = build("open");
      await runFrames(() => engine.snapTo("closed"), 32);

      expect(engine.state.size).toBe(0);
      expect(sheet.style.getPropertyValue("--bs-progress")).toBe("0");
      expect(backdrop.style.opacity).toBe("0");
      expect(scrim.style.opacity).toBe("0");
      expect(scrim.style.display).toBe("none");
      drop();
    });

    it("an open that ends in small steps leaves progress and both dim layers at one", async () => {
      const { engine, sheet, backdrop, scrim, drop } = build("half");
      await runFrames(() => engine.snapTo("open"), 32);

      expect(engine.state.size).toBe(800);
      expect(sheet.style.getPropertyValue("--bs-progress")).toBe("1");
      expect(backdrop.style.opacity).toBe("1");
      expect(scrim.style.opacity).toBe("1");
      drop();
    });

    const steady = (t: number): number => t;

    it("a dimmed-down backdrop ends on its exact opacity whatever the last step is", async () => {
      const wrong: string[] = [];
      for (let duration = 1000; duration < 1016; duration++) {
        const { engine, backdrop, drop } = build("half", {
          backdropOpacity: 0.5,
          easing: steady,
          duration,
        });
        await runFrames(() => engine.snapTo("open"), 80);
        if (backdrop.style.opacity !== "0.5") {
          wrong.push(`${duration}ms: ${backdrop.style.opacity}`);
        }
        drop();
      }
      expect(wrong).toEqual([]);
    });

    it("a fade spread wider than the sheet's travel ends on its exact opacity", async () => {
      const wrong: string[] = [];
      for (let duration = 1000; duration < 1016; duration++) {
        const { engine, backdrop, drop } = build("half", {
          backdropRange: [0, 2],
          easing: steady,
          duration,
        });
        await runFrames(() => engine.snapTo("open"), 80);
        if (backdrop.style.opacity !== "0.5") {
          wrong.push(`${duration}ms: ${backdrop.style.opacity}`);
        }
        drop();
      }
      expect(wrong).toEqual([]);
    });

    it("a snap between two open points leaves the exact progress", async () => {
      const { engine, sheet, backdrop, drop } = build("open");
      await runFrames(() => engine.snapTo("half"), 32);

      expect(sheet.style.getPropertyValue("--bs-progress")).toBe("0.5");
      expect(backdrop.style.opacity).toBe("0.5");
      drop();
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
