import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

const makeDom = () => {
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

const base = (sheet: HTMLElement, handle: HTMLElement, openSize: number) => ({
  element: sheet,
  handle,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "open", size: openSize },
  ],
  initial: "closed",
  maxHeight: 600,
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
});

describe("BottomSheetEngine — maxHeight clamp (no upward gap when a snap exceeds the cap)", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("a snap taller than maxHeight settles flush (offset 0, --bs-size === cap), not shifted up", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine(base(sheet, handle, 900));
    await engine.open("open");
    expect(engine.state.size).toBe(600);
    expect(sheet.style.transform).toBe("translate3d(0, 0px, 0)");
    expect(sheet.style.getPropertyValue("--bs-size")).toBe("600px");
    engine.destroy();
  });

  it("closed state still pushes fully off (offset === maxAxisSize cap)", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      ...base(sheet, handle, 900),
      initial: "open",
    });
    await engine.close();
    expect(engine.state.size).toBe(0);
    expect(sheet.style.transform).toBe("translate3d(0, 600px, 0)");
    engine.destroy();
  });

  it("a snap shorter than maxHeight rests at its own size (offset 0), unchanged", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine(base(sheet, handle, 400));
    await engine.open("open");
    expect(engine.state.size).toBe(400);
    expect(sheet.style.transform).toBe("translate3d(0, 0px, 0)");
    expect(sheet.style.getPropertyValue("--bs-size")).toBe("400px");
    engine.destroy();
  });

  it("a 'fit'/'content' snap taller than the cap settles flush at the cap", () => {
    const { sheet, handle } = makeDom();
    const content = document.createElement("div");
    sheet.appendChild(content);
    Object.defineProperty(handle, "offsetHeight", { value: 0, configurable: true });
    Object.defineProperty(content, "scrollHeight", { value: 900, configurable: true });
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: "fit" },
      ],
      initial: "open",
      maxHeight: 600,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.state.size).toBe(600);
    expect(sheet.style.transform).toBe("translate3d(0, 0px, 0)");
    expect(sheet.style.getPropertyValue("--bs-size")).toBe("600px");
    engine.destroy();
  });

  it("snap/open events report the clamped size and progress 1 at the cap (not the unclamped snap)", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine(base(sheet, handle, 900));
    const snaps: { size: number; progress: number }[] = [];
    engine.on("snap", p => snaps.push({ size: p.size, progress: p.progress }));
    await engine.open("open");
    const last = snaps[snaps.length - 1]!;
    expect(last.size).toBe(600);
    expect(last.progress).toBe(1);
    engine.destroy();
  });

  it("clamps on the horizontal axis too (max-width for left/right modes)", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      ...base(sheet, handle, 900),
      mode: "left",
    });
    await engine.open("open");
    expect(engine.state.size).toBe(600);
    expect(sheet.style.getPropertyValue("--bs-size")).toBe("600px");
    engine.destroy();
  });
});
