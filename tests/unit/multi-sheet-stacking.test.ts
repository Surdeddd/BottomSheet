import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

const makeSheet = () => {
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  const backdrop = document.createElement("div");
  sheet.appendChild(handle);
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { sheet, handle, backdrop };
};

const opts = (n: ReturnType<typeof makeSheet>) => ({
  element: n.sheet,
  handle: n.handle,
  backdrop: n.backdrop,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "full", size: 800 },
  ],
  initial: "closed",
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
});

describe("BottomSheetEngine — multi-sheet stacking", () => {
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

  it("most recently opened sheet is on top, regardless of construction order", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));
    await engineB.open("full");
    await engineA.open("full");
    const zA = parseInt(a.sheet.style.zIndex, 10);
    const zB = parseInt(b.sheet.style.zIndex, 10);
    expect(zA).toBeGreaterThan(zB);
    expect(a.backdrop.style.display).not.toBe("none");
    expect(b.backdrop.style.display).not.toBe("none");
    engineA.destroy();
    engineB.destroy();
  });

  it("closing the top sheet returns top status to the one below", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));
    await engineA.open("full");
    await engineB.open("full");
    expect(b.backdrop.style.display).not.toBe("none");
    await engineB.close();
    expect(a.backdrop.style.display).not.toBe("none");
    engineA.destroy();
    engineB.destroy();
  });

  it("a constructed-but-closed sheet never steals top from an open one", async () => {
    const a = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    await engineA.open("full");
    const b = makeSheet();
    const engineB = new BottomSheetEngine(opts(b));
    expect(a.backdrop.style.display).not.toBe("none");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await new Promise(r => setTimeout(r, 30));
    expect(engineA.state.activeId).toBe("closed");
    engineA.destroy();
    engineB.destroy();
  });

  it("Escape closes only the top sheet of the stack", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));
    await engineA.open("full");
    await engineB.open("full");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await new Promise(r => setTimeout(r, 30));
    expect(engineB.state.activeId).toBe("closed");
    expect(engineA.state.activeId).toBe("full");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await new Promise(r => setTimeout(r, 30));
    expect(engineA.state.activeId).toBe("closed");
    engineA.destroy();
    engineB.destroy();
  });

  it("stackEffect scales back sheets by depth and restores on top close", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine({ ...opts(a), stackEffect: true });
    const engineB = new BottomSheetEngine({ ...opts(b), stackEffect: true });
    await engineA.open("full");
    expect(a.sheet.getAttribute("data-stack-depth")).toBe("0");
    await engineB.open("full");
    expect(b.sheet.getAttribute("data-stack-depth")).toBe("0");
    expect(a.sheet.getAttribute("data-stack-depth")).toBe("1");
    await engineB.close();
    expect(a.sheet.getAttribute("data-stack-depth")).toBe("0");
    engineA.destroy();
    engineB.destroy();
  });

  it("top sheet backdrop sits above the sheets below it", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));
    await engineA.open("full");
    await engineB.open("full");
    const zLower = parseInt(a.sheet.style.zIndex, 10);
    const zTopBackdrop = parseInt(b.backdrop.style.zIndex, 10);
    expect(zTopBackdrop).toBeGreaterThan(zLower);
    engineA.destroy();
    engineB.destroy();
  });

  it("ten stacked sheets open and unwind cleanly via Escape", async () => {
    const nodes = Array.from({ length: 10 }, () => makeSheet());
    const engines = nodes.map(n => new BottomSheetEngine(opts(n)));
    for (const e of engines) await e.open("full");
    for (let i = engines.length - 1; i >= 0; i--) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await new Promise(r => setTimeout(r, 20));
      expect(engines[i]!.state.activeId).toBe("closed");
      if (i > 0) expect(engines[i - 1]!.state.activeId).toBe("full");
    }
    engines.forEach(e => e.destroy());
  });
});
