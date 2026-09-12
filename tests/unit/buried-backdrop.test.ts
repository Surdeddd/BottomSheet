import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { POINTER_EVENTS_OPACITY_THRESHOLD } from "../../src/core/primitives/hot-path-thresholds";

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
    { id: "half", size: 400 },
    { id: "full", size: 800 },
  ],
  initial: "closed",
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
});

const dim = (n: ReturnType<typeof makeSheet>) => Number(n.backdrop.style.opacity);
const clickable = (n: ReturnType<typeof makeSheet>) =>
  n.backdrop.style.pointerEvents === "auto";

describe("buried sheets never hold a live backdrop", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("drops the backdrop of a sheet that loses top status to a second sheet", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    expect(dim(a)).toBeGreaterThan(0);
    expect(clickable(a)).toBe(true);

    await engineB.open("full");

    expect(dim(a)).toBe(0);
    expect(clickable(a)).toBe(false);
    expect(dim(b)).toBeGreaterThan(0);
    expect(clickable(b)).toBe(true);

    engineA.destroy();
    engineB.destroy();
  });

  it("keeps exactly one dimming backdrop no matter how deep the stack goes", async () => {
    const nodes = [makeSheet(), makeSheet(), makeSheet(), makeSheet()];
    const engines = nodes.map(n => new BottomSheetEngine(opts(n)));

    for (const engine of engines) await engine.open("full");

    const dimming = nodes.filter(n => dim(n) > 0);
    const trapping = nodes.filter(clickable);
    expect(dimming).toHaveLength(1);
    expect(trapping).toHaveLength(1);
    expect(dimming[0]).toBe(nodes.at(-1));

    for (const engine of engines) engine.destroy();
  });

  it("leaves no clickable backdrop behind when a buried sheet closes", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    await engineA.close();

    expect(dim(a)).toBe(0);
    expect(clickable(a)).toBe(false);

    engineA.destroy();
    engineB.destroy();
  });

  it("clears every backdrop once the whole stack has closed", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    await engineA.close();
    await engineB.close();

    for (const n of [a, b]) {
      expect(dim(n)).toBeLessThan(POINTER_EVENTS_OPACITY_THRESHOLD);
      expect(clickable(n)).toBe(false);
    }

    engineA.destroy();
    engineB.destroy();
  });

  it("repaints the backdrop of the sheet that inherits top status", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    expect(dim(a)).toBe(0);

    await engineB.close();

    expect(dim(a)).toBeGreaterThan(0);
    expect(clickable(a)).toBe(true);

    engineA.destroy();
    engineB.destroy();
  });

  it("hands the dimming backdrop back and forth as top status moves", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    await engineB.close();
    await engineB.open("full");

    expect(dim(a)).toBe(0);
    expect(clickable(a)).toBe(false);
    expect(dim(b)).toBeGreaterThan(0);

    await engineB.close();

    expect(dim(a)).toBeGreaterThan(0);
    expect(clickable(a)).toBe(true);

    engineA.destroy();
    engineB.destroy();
  });

  it("still tracks progress on the sheet that owns the backdrop", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    const atFull = dim(b);
    await engineB.snapTo("half");
    const atHalf = dim(b);

    expect(atFull).toBeGreaterThan(atHalf);
    expect(dim(a)).toBe(0);

    engineA.destroy();
    engineB.destroy();
  });

  it("does not resurrect a buried backdrop when the buried sheet snaps", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    await engineA.snapTo("half");

    expect(dim(a)).toBe(0);
    expect(clickable(a)).toBe(false);

    engineA.destroy();
    engineB.destroy();
  });

  it("survives churn across a three-deep stack without stranding a scrim", async () => {
    const nodes = [makeSheet(), makeSheet(), makeSheet()];
    const engines = nodes.map(n => new BottomSheetEngine(opts(n)));

    for (let round = 0; round < 4; round++) {
      for (const engine of engines) await engine.open("full");
      for (const engine of engines) await engine.close();
    }

    for (const n of nodes) {
      expect(dim(n)).toBeLessThan(POINTER_EVENTS_OPACITY_THRESHOLD);
      expect(clickable(n)).toBe(false);
    }

    for (const engine of engines) engine.destroy();
  });

  it("releases the backdrop of a buried sheet destroyed while the stack is live", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    engineA.destroy();

    expect(clickable(a)).toBe(false);

    engineB.destroy();
  });

  it("gives the backdrop to the survivor when the top sheet is destroyed", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    engineB.destroy();

    expect(dim(a)).toBeGreaterThan(0);
    expect(clickable(a)).toBe(true);

    engineA.destroy();
  });
});
