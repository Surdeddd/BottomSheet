import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { createEventBus } from "../../src/core/primitives/event-bus";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { makeDom } from "./_helpers/makeDom";

const collectAsyncErrors = (): { errors: unknown[]; restore: () => void } => {
  const errors: unknown[] = [];
  const original = globalThis.queueMicrotask;
  globalThis.queueMicrotask = (fn: () => void): void => {
    original(() => {
      try {
        fn();
      } catch (err) {
        errors.push(err);
      }
    });
  };
  return {
    errors,
    restore: () => {
      globalThis.queueMicrotask = original;
    },
  };
};

describe("event bus listener isolation", () => {
  it("keeps calling the remaining listeners after one throws", async () => {
    const trap = collectAsyncErrors();
    const bus = createEventBus<{ ping: number }>();
    const seen: number[] = [];
    bus.on("ping", () => {
      throw new Error("first listener failed");
    });
    bus.on("ping", value => seen.push(value));
    expect(() => bus.emit("ping", 7)).not.toThrow();
    expect(seen).toEqual([7]);
    await Promise.resolve();
    await Promise.resolve();
    trap.restore();
    expect(trap.errors).toHaveLength(1);
    expect(String(trap.errors[0])).toContain("first listener failed");
  });
});

describe("a throwing listener does not corrupt the sheet lifecycle", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("releases the body scroll lock when a close listener throws", async () => {
    const trap = collectAsyncErrors();
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
    await engine.open("full");
    expect(document.body.style.position).toBe("fixed");
    engine.on("close", () => {
      throw new Error("consumer onClose failed");
    });
    const closed = vi.fn();
    engine.on("closed", closed);

    await expect(engine.close()).resolves.toBe("landed");
    await Promise.resolve();
    trap.restore();

    expect(engine.state.size).toBe(0);
    expect(document.body.style.position).toBe("");
    expect(closed).toHaveBeenCalledTimes(1);
    expect(trap.errors.map(String).join()).toContain("consumer onClose failed");
    engine.destroy();
  });
});
