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

type Nodes = ReturnType<typeof makeSheet>;

const opts = (n: Nodes, duration = 0) => ({
  element: n.sheet,
  handle: n.handle,
  backdrop: n.backdrop,
  snapPoints: [
    { id: "minimized", size: 0 },
    { id: "half", size: 400 },
    { id: "full", size: 800 },
  ],
  initial: "minimized",
  animation: "tween" as const,
  duration,
  respectReducedMotion: false,
});

const dim = (n: Nodes) => Number(n.backdrop.style.opacity);
const clickable = (n: Nodes) => n.backdrop.style.pointerEvents === "auto";
const z = (n: Nodes) => parseInt(n.sheet.style.zIndex, 10);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const sampleWhile = async (
  busy: Promise<unknown>,
  read: () => void,
  everyMs = 8,
): Promise<void> => {
  let done = false;
  void busy.then(() => {
    done = true;
  });
  while (!done) {
    read();
    await sleep(everyMs);
  }
  read();
};

describe("every sheet in a stack owns its backdrop", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("dims with the backdrop of each open sheet, not just the top one", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");

    expect(dim(a)).toBeGreaterThan(POINTER_EVENTS_OPACITY_THRESHOLD);
    expect(clickable(a)).toBe(true);
    expect(dim(b)).toBeGreaterThan(POINTER_EVENTS_OPACITY_THRESHOLD);
    expect(clickable(b)).toBe(true);

    engineA.destroy();
    engineB.destroy();
  });

  it("keeps a live backdrop under every sheet of a four-deep stack", async () => {
    const nodes = [makeSheet(), makeSheet(), makeSheet(), makeSheet()];
    const engines = nodes.map(n => new BottomSheetEngine(opts(n)));

    for (const engine of engines) await engine.open("full");

    for (const n of nodes) {
      expect(dim(n)).toBeGreaterThan(POINTER_EVENTS_OPACITY_THRESHOLD);
      expect(clickable(n)).toBe(true);
    }

    for (const engine of engines) engine.destroy();
  });

  it("never lets the page show through while the top sheet closes over another", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a, 120));
    const engineB = new BottomSheetEngine(opts(b, 120));
    await engineA.open("half");
    await engineB.open("half");

    const seen: Array<{ dim: number; clickable: boolean }> = [];
    await sampleWhile(engineB.close(), () => {
      seen.push({ dim: dim(a), clickable: clickable(a) });
    });

    expect(seen.length).toBeGreaterThan(3);
    for (const s of seen) {
      expect(s.dim).toBeGreaterThan(POINTER_EVENTS_OPACITY_THRESHOLD);
      expect(s.clickable).toBe(true);
    }

    engineA.destroy();
    engineB.destroy();
  });

  it("leaves no clickable backdrop behind when a buried sheet closes", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    await engineA.close();

    expect(dim(a)).toBeLessThan(POINTER_EVENTS_OPACITY_THRESHOLD);
    expect(clickable(a)).toBe(false);
    expect(clickable(b)).toBe(true);

    engineA.destroy();
    engineB.destroy();
  });

  it("releases the backdrop of a buried sheet that closes with a real animation", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a, 120));
    const engineB = new BottomSheetEngine(opts(b, 120));

    await engineA.open("full");
    await engineB.open("full");
    await engineA.close();

    expect(dim(a)).toBeLessThan(POINTER_EVENTS_OPACITY_THRESHOLD);
    expect(clickable(a)).toBe(false);

    engineA.destroy();
    engineB.destroy();
  });

  it("clears every backdrop once the whole stack has closed", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a, 120));
    const engineB = new BottomSheetEngine(opts(b, 120));

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

  it("drives a buried sheet's backdrop from its own snap point", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    const atFull = dim(a);
    await engineA.snapTo("half");

    expect(dim(a)).toBeLessThan(atFull);
    expect(dim(a)).toBeGreaterThan(0);

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

  it("keeps the survivor dimmed when the top sheet is destroyed", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("full");
    await engineB.open("full");
    engineB.destroy();

    expect(dim(a)).toBeGreaterThan(POINTER_EVENTS_OPACITY_THRESHOLD);
    expect(clickable(a)).toBe(true);

    engineA.destroy();
  });
});

describe("the stack keeps the order sheets were opened in", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("keeps a sheet on top when the one beneath finishes opening after it", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a, 200));
    const engineB = new BottomSheetEngine(opts(b, 200));

    const openingA = engineA.open("half");
    await sleep(40);
    const openingB = engineB.open("half");

    const order: Array<{ bOnTop: boolean; zB: number; zA: number }> = [];
    await sampleWhile(Promise.all([openingA, openingB]), () => {
      order.push({ bOnTop: engineB.isTop(), zB: z(b), zA: z(a) });
    });

    expect(order.length).toBeGreaterThan(5);
    for (const o of order) {
      expect(o.bOnTop).toBe(true);
      expect(o.zB).toBeGreaterThan(o.zA);
    }

    engineA.destroy();
    engineB.destroy();
  });

  it("reproduces the report: open one, open another 500ms later, and the second stays on top", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine({ ...opts(a), animation: "spring" as const });
    const engineB = new BottomSheetEngine({ ...opts(b), animation: "spring" as const });

    const openingA = engineA.open("half");
    await sleep(120);
    const openingB = engineB.open("half");

    let flipped = false;
    await sampleWhile(Promise.all([openingA, openingB]), () => {
      if (!engineB.isTop() || z(b) <= z(a)) flipped = true;
    });

    expect(flipped).toBe(false);
    expect(engineB.depth()).toBe(0);
    expect(engineA.depth()).toBe(1);

    engineA.destroy();
    engineB.destroy();
  });

  it("still lifts a sheet that opens at mount above the ones constructed before it", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine({ ...opts(b), initial: "half" });

    expect(engineB.isTop()).toBe(true);
    expect(z(b)).toBeGreaterThan(z(a));

    await engineA.open("half");
    expect(engineA.isTop()).toBe(true);

    engineA.destroy();
    engineB.destroy();
  });

  it("lets a sheet reopened after closing go back on top", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = new BottomSheetEngine(opts(a));
    const engineB = new BottomSheetEngine(opts(b));

    await engineA.open("half");
    await engineB.open("half");
    await engineA.close();
    await engineA.open("half");

    expect(engineA.isTop()).toBe(true);
    expect(z(a)).toBeGreaterThan(z(b));

    engineA.destroy();
    engineB.destroy();
  });
});
