import { describe, expect, it, beforeEach, vi } from "vitest";
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

const pressEscape = (): void => {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
};

describe("BottomSheetEngine — persistent", () => {
  beforeEach(() => resetGlobals());

  it("blocks Escape dismissal but allows programmatic close()", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      persistent: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.canDismiss()).toBe(false);

    pressEscape();
    await new Promise(r => setTimeout(r, 30));
    expect(engine.state.activeId).toBe("full");

    await engine.close();
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });

  it("does not emit close on Escape while persistent", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      persistent: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onClose = vi.fn();
    engine.on("close", onClose);
    pressEscape();
    await new Promise(r => setTimeout(r, 30));
    expect(onClose).not.toHaveBeenCalled();
    engine.destroy();
  });
});

describe("BottomSheetEngine — disableClose", () => {
  beforeEach(() => resetGlobals());

  it("blocks both Escape and programmatic close()", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      disableClose: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.canDismiss()).toBe(false);

    pressEscape();
    await new Promise(r => setTimeout(r, 30));
    expect(engine.state.activeId).toBe("full");

    await engine.close();
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });

  it("does not emit before-close or close while disableClose", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      disableClose: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onBeforeClose = vi.fn();
    const onClose = vi.fn();
    engine.on("before-close", onBeforeClose);
    engine.on("close", onClose);
    await engine.close();
    expect(onBeforeClose).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    engine.destroy();
  });
});

describe("BottomSheetEngine — before-close cancel", () => {
  beforeEach(() => resetGlobals());

  it("a listener calling cancel() aborts the close", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const reasons: string[] = [];
    engine.on("before-close", p => {
      reasons.push(p.reason);
      p.cancel();
    });
    await engine.close();
    expect(reasons).toEqual(["programmatic"]);
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });

  it("escape close carries reason 'escape' and proceeds when not cancelled", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const reasons: string[] = [];
    engine.on("before-close", p => reasons.push(p.reason));
    pressEscape();
    await new Promise(r => setTimeout(r, 30));
    expect(reasons).toEqual(["escape"]);
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });
});

describe("BottomSheetEngine — disableDrag", () => {
  beforeEach(() => resetGlobals());

  it("prevents a drag from starting (no dragstart, isDragging stays false)", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 800 },
      ],
      initial: "b",
      disableDrag: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onDragStart = vi.fn();
    engine.on("dragstart", onDragStart);
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: 100, pointerId: 1, button: 0 }),
    );
    handle.dispatchEvent(
      new PointerEvent("pointermove", { clientY: 40, pointerId: 1 }),
    );
    expect(onDragStart).not.toHaveBeenCalled();
    expect(engine.state.isDragging).toBe(false);
    expect(engine.state.size).toBe(800);
    engine.destroy();
  });

  it("allows a drag to start when disableDrag is not set (control)", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 800 },
      ],
      initial: "b",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onDragStart = vi.fn();
    engine.on("dragstart", onDragStart);
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: 100, pointerId: 1, button: 0 }),
    );
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(engine.state.isDragging).toBe(true);
    handle.dispatchEvent(
      new PointerEvent("pointerup", { clientY: 100, pointerId: 1 }),
    );
    engine.destroy();
  });
});

describe("BottomSheetEngine — expand / collapse", () => {
  beforeEach(() => resetGlobals());

  it("expand() snaps to the largest allowed snap by size", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "half", size: 400 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.expand();
    expect(engine.state.activeId).toBe("full");
    expect(engine.state.size).toBe(800);
    engine.destroy();
  });

  it("collapse() snaps to the smallest NON-ZERO allowed snap", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.collapse();
    expect(engine.state.activeId).toBe("min");
    expect(engine.state.size).toBe(100);
    engine.destroy();
  });

  it("collapse() falls back to the smallest snap when all are zero", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "closed", size: 0 }],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.collapse();
    expect(engine.state.activeId).toBe("closed");
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });
});

describe("BottomSheetEngine — isTop / depth", () => {
  beforeEach(() => resetGlobals());

  const makeStacked = () => {
    const sheet = document.createElement("section");
    const handle = document.createElement("div");
    sheet.appendChild(handle);
    document.body.appendChild(sheet);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    return { sheet, handle };
  };

  it("single open sheet is top with depth 0", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "full", size: 800 }],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.isTop()).toBe(true);
    expect(engine.depth()).toBe(0);
    engine.destroy();
  });

  it("second opened sheet becomes top; first reports depth > 0 and not top", async () => {
    const domA = makeDom();
    const engineA = new BottomSheetEngine({
      element: domA.sheet,
      handle: domA.handle,
      snapPoints: [{ id: "full", size: 800 }],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    const domB = makeStacked();
    const engineB = new BottomSheetEngine({
      element: domB.sheet,
      handle: domB.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 600 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engineB.open("full");

    expect(engineB.isTop()).toBe(true);
    expect(engineB.depth()).toBe(0);
    expect(engineA.isTop()).toBe(false);
    expect(engineA.depth()).toBeGreaterThan(0);

    engineB.destroy();
    engineA.destroy();
  });
});

describe("BottomSheetEngine — setRadius / setMaxHeight", () => {
  beforeEach(() => resetGlobals());

  it("setRadius(number) sets --bs-radius in px", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "full", size: 800 }],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setRadius(24);
    expect(sheet.style.getPropertyValue("--bs-radius")).toBe("24px");
    engine.destroy();
  });

  it("setRadius(string) sets --bs-radius verbatim", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "full", size: 800 }],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setRadius("1rem");
    expect(sheet.style.getPropertyValue("--bs-radius")).toBe("1rem");
    engine.destroy();
  });

  it("radius option applies --bs-radius at construction", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "full", size: 800 }],
      initial: "full",
      radius: 16,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(sheet.style.getPropertyValue("--bs-radius")).toBe("16px");
    engine.destroy();
  });

  it("setMaxHeight(number) clamps the resolved maxAxisSize and current size", () => {
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
    engine.setMaxHeight(500);
    const max = (
      engine as unknown as { snaps: { getMaxAxisSize: () => number } }
    ).snaps.getMaxAxisSize();
    expect(max).toBe(500);
    expect(engine.state.size).toBe(500);
    engine.destroy();
  });

  it("maxHeight option clamps the resolved maxAxisSize at construction", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      maxHeight: 600,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const max = (
      engine as unknown as { snaps: { getMaxAxisSize: () => number } }
    ).snaps.getMaxAxisSize();
    expect(max).toBe(600);
    engine.destroy();
  });

  it("setRadius / setMaxHeight no-op after destroy", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "full", size: 800 }],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.destroy();
    const radiusBefore = sheet.style.getPropertyValue("--bs-radius");
    const maxBefore = sheet.style.maxHeight;
    expect(() => engine.setRadius(40)).not.toThrow();
    expect(() => engine.setMaxHeight(400)).not.toThrow();
    expect(sheet.style.getPropertyValue("--bs-radius")).toBe(radiusBefore);
    expect(sheet.style.maxHeight).toBe(maxBefore);
  });
});
