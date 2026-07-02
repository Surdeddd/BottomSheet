import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { makeDom } from "./_helpers/makeDom";
import type { BottomSheetProps } from "../../src/solid/index";
import type { SheetEventMap } from "../../src/core/types";

const resetGlobals = () => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
};

describe("Solid onBeforeClose — synchronous cancel keeps the sheet open", () => {
  beforeEach(() => resetGlobals());

  it("cancelling before-close (Solid sync callback) leaves the sheet at its open size", async () => {
    const { sheet, handle, backdrop } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    const onBeforeClose = vi.fn(
      (payload: SheetEventMap["before-close"]) => payload.cancel(),
    );
    engine.on("before-close", payload => onBeforeClose(payload));

    await engine.open("full");
    expect(engine.state.size).toBe(400);

    await engine.close();

    expect(onBeforeClose).toHaveBeenCalledOnce();
    expect(engine.state.size).toBe(400);

    engine.destroy();
  });

  it("without a cancel, close proceeds to size 0", async () => {
    const { sheet, handle, backdrop } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onBeforeClose = vi.fn();
    engine.on("before-close", payload => onBeforeClose(payload));

    await engine.open("full");
    await engine.close();

    expect(onBeforeClose).toHaveBeenCalledOnce();
    expect(engine.state.size).toBe(0);

    engine.destroy();
  });
});

describe("Solid BottomSheetProps — lifecycle/drag/progress callbacks are typed", () => {
  it("exposes the new callback props (compile-time contract)", () => {
    const props: BottomSheetProps<"closed" | "full"> = {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      onBeforeClose: p => p.cancel(),
      onOpen: id => void id,
      onClose: () => {},
      onOpened: id => void id,
      onClosed: () => {},
      onDragStart: p => void p.size,
      onDragEnd: p => void p.velocity,
      onDrag: p => void p.delta,
      onProgress: p => void p.value,
    };
    expect(typeof props.onOpen).toBe("function");
    expect(typeof props.onClose).toBe("function");
    expect(typeof props.onBeforeClose).toBe("function");
    expect(typeof props.onDrag).toBe("function");
    expect(typeof props.onProgress).toBe("function");
  });
});
