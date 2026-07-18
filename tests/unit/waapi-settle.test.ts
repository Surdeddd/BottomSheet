import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  sampleSpringSettle,
  sampleTweenSettle,
} from "../../src/core/animation/waapi-settle";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

const settle = () => new Promise(r => setTimeout(r, 30));

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

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
});

describe("waapi settle samplers", () => {
  it("spring samples start at from, end exactly at to, and converge", () => {
    const s = sampleSpringSettle(0, 300, 0, { stiffness: 220, damping: 26 });
    expect(s.values[0]).toBe(0);
    expect(s.values[s.values.length - 1]).toBe(300);
    expect(s.values.length).toBeGreaterThan(5);
    expect(s.durationMs).toBeGreaterThan(0);
    expect(s.durationMs).toBeLessThanOrEqual(3100);
    const tail = s.values.slice(-3);
    for (const v of tail) expect(Math.abs(v - 300)).toBeLessThan(20);
  });

  it("spring sampler caps runaway configs at the simulation limit", () => {
    const s = sampleSpringSettle(0, 300, 0, { stiffness: 500, damping: 0.01 });
    expect(s.durationMs).toBeLessThanOrEqual(3100);
    expect(s.values[s.values.length - 1]).toBe(300);
  });

  it("tween samples follow the easing and end at to", () => {
    const linear = (t: number) => t;
    const s = sampleTweenSettle(100, 200, 160, linear);
    expect(s.values[0]).toBe(100);
    expect(s.values[s.values.length - 1]).toBe(200);
    expect(s.durationMs).toBe(160);
    const mid = s.values[Math.floor(s.values.length / 2)]!;
    expect(mid).toBeGreaterThan(120);
    expect(mid).toBeLessThan(180);
  });
});

describe("waapi settle engine path", () => {
  it("falls back to rAF animation when element.animate is missing (happy-dom)", async () => {
    const n = makeSheet();
    const engine = new BottomSheetEngine({
      element: n.sheet,
      handle: n.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 300 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      settleAnimation: "waapi",
    });
    expect(typeof n.sheet.animate).not.toBe("function");
    await engine.snapTo("half");
    await settle();
    expect(engine.state.size).toBe(300);
    expect(n.sheet.style.getPropertyValue("--bs-size")).toBe("300px");
    engine.destroy();
  });

  it("drives WAAPI with sampled transform keyframes and finalizes inline styles", async () => {
    const n = makeSheet();
    let captured: {
      frames: Array<Record<string, string>>;
      options: KeyframeAnimationOptions;
    } | null = null;
    let finishResolve: (() => void) | null = null;
    const fakeAnim = {
      playState: "running",
      finished: new Promise<void>(r => {
        finishResolve = () => {
          fakeAnim.playState = "finished";
          r();
        };
      }),
      cancel: vi.fn(() => {
        fakeAnim.playState = "idle";
      }),
    };
    (n.sheet as unknown as { animate: unknown }).animate = vi.fn(
      (frames: Array<Record<string, string>>, options: KeyframeAnimationOptions) => {
        captured = { frames, options };
        return fakeAnim;
      },
    );

    const engine = new BottomSheetEngine({
      element: n.sheet,
      handle: n.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 300 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 120,
      easing: t => t,
      respectReducedMotion: false,
      settleAnimation: "waapi",
    });

    const opened: string[] = [];
    engine.on("opened", p => opened.push(p.id));

    const inlineBefore = n.sheet.style.transform;
    const p = engine.snapTo("half");
    await new Promise(r => setTimeout(r, 10));

    expect(captured).not.toBeNull();
    const frames = captured!.frames;
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[frames.length - 1]!.transform).toContain("translate3d");
    expect(captured!.options.easing).toBe("linear");
    expect(captured!.options.fill).toBe("forwards");
    expect(n.sheet.style.transform).toBe(inlineBefore);
    expect(engine.state.isAnimating).toBe(true);

    finishResolve!();
    await p;
    await settle();

    expect(engine.state.size).toBe(300);
    expect(n.sheet.style.transform).toContain("translate3d");
    expect(fakeAnim.cancel).toHaveBeenCalled();
    expect(opened).toEqual(["half"]);
    engine.destroy();
  });

  it("cancel mid-waapi aborts without finalizing to target", async () => {
    const n = makeSheet();
    const fakeAnim = {
      playState: "running",
      finished: new Promise<void>(() => {}),
      cancel: vi.fn(() => {
        fakeAnim.playState = "idle";
      }),
    };
    (n.sheet as unknown as { animate: unknown }).animate = () => fakeAnim;

    const engine = new BottomSheetEngine({
      element: n.sheet,
      handle: n.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 300 },
        { id: "full", size: 600 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 200,
      respectReducedMotion: false,
      settleAnimation: "waapi",
    });

    void engine.snapTo("half");
    await new Promise(r => setTimeout(r, 10));
    expect(engine.state.isAnimating).toBe(true);

    engine.setSnapPoints(
      [
        { id: "closed", size: 0 },
        { id: "half", size: 300 },
      ],
      ["closed", "half"],
    );
    await settle();
    expect(fakeAnim.cancel).toHaveBeenCalled();
    engine.destroy();
  });
});
