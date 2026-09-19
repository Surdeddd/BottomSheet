import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const makeSheet = () => {
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

const setViewportHeight = (h: number): void => {
  Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
};

const build = (
  n: ReturnType<typeof makeSheet>,
  half: number | string = 300,
  duration = 200,
) =>
  new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: half },
    ],
    initial: "closed",
    animation: "tween",
    duration,
    respectReducedMotion: false,
  });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Watch = { target: Element; run: () => void };
const watches: Watch[] = [];
const RealResizeObserver = globalThis.ResizeObserver;

class ControlledResizeObserver {
  private own: Watch[] = [];
  constructor(private cb: ResizeObserverCallback) {}
  observe(target: Element): void {
    const watch: Watch = {
      target,
      run: () => this.cb([], this as unknown as ResizeObserver),
    };
    this.own.push(watch);
    watches.push(watch);
  }
  unobserve(): void {}
  disconnect(): void {
    for (const w of this.own) {
      const i = watches.indexOf(w);
      if (i !== -1) watches.splice(i, 1);
    }
    this.own = [];
  }
}

const installControlledObserver = (): void => {
  watches.length = 0;
  globalThis.ResizeObserver =
    ControlledResizeObserver as unknown as typeof ResizeObserver;
};

const restoreObserver = (): void => {
  globalThis.ResizeObserver = RealResizeObserver;
};

const fireRootResize = (): void => {
  for (const w of watches.slice()) {
    if (w.target === document.documentElement) w.run();
  }
};

const reset = (): void => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  setViewportHeight(1000);
  installControlledObserver();
};

describe("a root resize that changes nothing for the sheet", () => {
  beforeEach(reset);
  afterEach(restoreObserver);

  it("reaches the engine through the observer this suite controls", () => {
    const engine = build(makeSheet());
    expect(watches.some(w => w.target === document.documentElement)).toBe(true);
    engine.destroy();
    expect(watches.some(w => w.target === document.documentElement)).toBe(false);
  });

  it("leaves a running open alone instead of teleporting it to the target", async () => {
    const engine = build(makeSheet());

    const opening = engine.open("half");
    await sleep(60);
    const midFlight = engine.state.size;
    expect(midFlight).toBeGreaterThan(0);
    expect(midFlight).toBeLessThan(300);

    fireRootResize();

    expect(engine.state.isAnimating).toBe(true);
    expect(engine.state.size).toBeLessThan(300);

    await opening;
    expect(engine.state.size).toBe(300);
    engine.destroy();
  });

  it("still runs the open sequence exactly once after such a resize", async () => {
    const engine = build(makeSheet());
    const events: string[] = [];
    engine.on("open", () => events.push("open"));
    engine.on("opened", () => events.push("opened"));
    engine.on("snap", () => events.push("snap"));

    const opening = engine.open("half");
    await sleep(60);
    fireRootResize();
    await opening;
    await sleep(20);

    expect(events.filter(e => e === "open")).toHaveLength(1);
    expect(events.filter(e => e === "opened")).toHaveLength(1);
    expect(events.filter(e => e === "snap")).toHaveLength(1);
    engine.destroy();
  });

  it("does not cut a second sheet's open short when the first one lands", async () => {
    const engineA = build(makeSheet(), 300, 120);
    const engineB = build(makeSheet(), 300, 240);
    let bSizeWhenALanded = -1;
    let bAnimatingAfterResize = false;
    engineA.on("opened", () => {
      fireRootResize();
      bSizeWhenALanded = engineB.state.size;
      bAnimatingAfterResize = engineB.state.isAnimating;
    });

    const openingA = engineA.open("half");
    await sleep(40);
    const openingB = engineB.open("half");
    await Promise.all([openingA, openingB]);

    expect(bSizeWhenALanded).toBeGreaterThan(0);
    expect(bSizeWhenALanded).toBeLessThan(300);
    expect(bAnimatingAfterResize).toBe(true);
    expect(engineB.state.size).toBe(300);
    engineA.destroy();
    engineB.destroy();
  });

  it("keeps an idle sheet where it is and announces nothing", async () => {
    const engine = build(makeSheet());
    await engine.open("half");
    const events: string[] = [];
    engine.on("snap", () => events.push("snap"));

    fireRootResize();

    expect(engine.state.size).toBe(300);
    expect(events).toEqual([]);
    engine.destroy();
  });

  it("survives a burst of such resizes during one open", async () => {
    const engine = build(makeSheet());
    const events: string[] = [];
    engine.on("opened", () => events.push("opened"));

    const opening = engine.open("half");
    for (let i = 0; i < 5; i++) {
      await sleep(25);
      fireRootResize();
    }
    await opening;

    expect(engine.state.size).toBe(300);
    expect(events).toHaveLength(1);
    engine.destroy();
  });
});

describe("a resize that does change the sheet's geometry", () => {
  beforeEach(reset);
  afterEach(restoreObserver);

  it("re-seats an idle sheet on a percent snap when the viewport shrinks", async () => {
    const engine = build(makeSheet(), "50%");
    await engine.open("half");
    expect(engine.state.size).toBe(500);

    setViewportHeight(800);
    fireRootResize();

    expect(engine.state.size).toBe(400);
    engine.destroy();
  });

  it("lands a running open on the new size rather than the stale one", async () => {
    const engine = build(makeSheet(), "50%");

    const opening = engine.open("half");
    await sleep(60);
    setViewportHeight(800);
    fireRootResize();
    await opening;
    await sleep(20);

    expect(engine.state.size).toBe(400);
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("clamps a pixel snap that no longer fits the viewport", async () => {
    const engine = build(makeSheet(), 900);
    await engine.open("half");
    expect(engine.state.size).toBe(900);

    setViewportHeight(600);
    fireRootResize();

    expect(engine.state.size).toBeLessThanOrEqual(600);
    engine.destroy();
  });
});
