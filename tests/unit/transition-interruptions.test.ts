import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";
import { makeDom, type DomNodes } from "./_helpers/makeDom";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const linear = (t: number): number => t;

const points = [
  { id: "closed", size: 0 },
  { id: "half", size: 300 },
  { id: "full", size: 800 },
];

const build = (
  initial: string,
  extra: Record<string, unknown> = {},
  dom: DomNodes = makeDom(),
) => {
  const engine = new BottomSheetEngine({
    element: dom.sheet,
    handle: dom.handle,
    backdrop: dom.backdrop,
    snapPoints: points,
    initial,
    animation: "tween",
    duration: 400,
    easing: linear,
    respectReducedMotion: false,
    ...extra,
  });
  return { dom, engine };
};

const record = (engine: BottomSheetEngine): string[] => {
  const log: string[] = [];
  for (const name of ["open", "opened", "close", "closed", "snap"] as const) {
    engine.on(name, () => log.push(name));
  }
  return log;
};

const pointer = (target: HTMLElement, type: string, clientY: number): void => {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      pointerType: "touch",
      bubbles: true,
      cancelable: true,
      clientY,
    } as PointerEventInit),
  );
};

class FakeVisualViewport extends EventTarget {
  height = 1000;
  width = 400;
}

const installVisualViewport = (): FakeVisualViewport => {
  const vv = new FakeVisualViewport();
  Object.defineProperty(window, "visualViewport", {
    value: vv,
    configurable: true,
  });
  return vv;
};

const setHidden = (hidden: boolean): void => {
  Object.defineProperty(document, "hidden", {
    value: hidden,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  __resetRouteCoordinatorForTests();
  document.body.removeAttribute("style");
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
  Object.defineProperty(window, "innerWidth", {
    value: 400,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "visualViewport", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  delete (document as unknown as { startViewTransition?: unknown })
    .startViewTransition;
});

describe("a gesture that interrupts a transition", () => {
  it("announces nothing when a closing sheet is caught, and keeps the page locked", async () => {
    const { dom, engine } = build("full");
    const log = record(engine);
    void engine.close();
    await wait(120);
    pointer(dom.handle, "pointerdown", 500);
    await wait(20);
    expect(log).toEqual(["close"]);
    expect(engine.state.isDragging).toBe(true);
    expect(engine.state.size).toBeGreaterThan(0);
    expect(engine.state.phase).toBe("closing");
    expect(dom.sheet.getAttribute("data-bs-rest")).toBeNull();
    expect(document.body.style.position).toBe("fixed");

    pointer(dom.handle, "pointerup", 500);
    await wait(700);
    expect(log).toEqual(["close", "snap", "closed"]);
    expect(engine.state.size).toBe(0);
    expect(document.body.style.position).toBe("");
    engine.destroy();
  });

  it("re-opens a closing sheet that is dragged back up", async () => {
    const { dom, engine } = build("full");
    const log = record(engine);
    void engine.close();
    await wait(120);
    pointer(dom.handle, "pointerdown", 600);
    pointer(dom.handle, "pointermove", 500);
    pointer(dom.handle, "pointermove", 400);
    pointer(dom.handle, "pointermove", 200);
    pointer(dom.handle, "pointerup", 200);
    await wait(700);
    expect(log).toEqual(["close", "open", "snap", "opened"]);
    expect(engine.state.size).toBeGreaterThan(0);
    expect(engine.state.phase).toBe("open");
    expect(document.body.style.position).toBe("fixed");
    engine.destroy();
  });

  it("holds opened back until an opening sheet that was caught has landed", async () => {
    const { dom, engine } = build("closed");
    const log = record(engine);
    void engine.open("full");
    await wait(120);
    pointer(dom.handle, "pointerdown", 500);
    await wait(20);
    expect(log).toEqual(["open"]);
    pointer(dom.handle, "pointerup", 500);
    await wait(700);
    expect(log).toEqual(["open", "snap", "opened"]);
    expect(engine.state.size).toBe(800);
    engine.destroy();
  });
});

describe("geometry that changes under a running transition", () => {
  it("keeps an opening alive through setSnapPoints and still announces it", async () => {
    const { engine } = build("closed");
    const log = record(engine);
    void engine.open("full");
    await wait(80);
    engine.setSnapPoints(points.map(p => ({ ...p })));
    expect(engine.state.isAnimating).toBe(true);
    expect(engine.state.size).toBeLessThan(700);
    await wait(700);
    expect(log).toEqual(["open", "snap", "opened"]);
    expect(engine.state.size).toBe(800);
    expect(document.body.style.position).toBe("fixed");
    engine.destroy();
  });

  it("lands on the new size when setSnapPoints moves the target mid-flight", async () => {
    const { engine } = build("closed");
    void engine.open("full");
    await wait(80);
    engine.setSnapPoints([
      { id: "closed", size: 0 },
      { id: "half", size: 300 },
      { id: "full", size: 600 },
    ]);
    await wait(700);
    expect(engine.state.size).toBe(600);
    expect(engine.state.phase).toBe("open");
    engine.destroy();
  });

  it("keeps the maxHeight cap across setSnapPoints", () => {
    const { dom, engine } = build("half", { maxHeight: 500, duration: 0 });
    const before = dom.sheet.style.transform;
    engine.setSnapPoints(points.map(p => ({ ...p })));
    expect(dom.sheet.style.height).toBe("500px");
    expect(dom.sheet.style.transform).toBe(before);
    engine.destroy();
  });

  it("lands on the grown size when content grows during the opening", async () => {
    const dom = makeDom();
    let natural = 239;
    Object.defineProperty(dom.sheet, "offsetHeight", {
      get: () => natural,
      configurable: true,
    });
    Object.defineProperty(dom.content, "clientHeight", {
      get: () => 100,
      configurable: true,
    });
    Object.defineProperty(dom.content, "scrollHeight", {
      get: () => 100,
      configurable: true,
    });
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: "content" },
      ],
      initial: "closed",
      animation: "tween",
      duration: 400,
      easing: linear,
      respectReducedMotion: false,
    });
    const sizes: number[] = [];
    engine.on("progress", p => sizes.push(p.size));
    void engine.open("open");
    await wait(100);
    natural = 776;
    engine.recompute();
    const rightAfter = engine.state.size;
    await wait(800);

    expect(rightAfter).toBeLessThan(239);
    expect(engine.state.size).toBe(776);
    expect(dom.sheet.style.transform).toBe("translate3d(0, 0px, 0)");
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!).toBeGreaterThanOrEqual(sizes[i - 1]! - 0.001);
    }
    engine.destroy();
  });

  it("does not flash a content sheet to full size when it opens in its first tick", async () => {
    const dom = makeDom();
    Object.defineProperty(dom.sheet, "offsetHeight", {
      get: () => 420,
      configurable: true,
    });
    Object.defineProperty(dom.content, "clientHeight", {
      get: () => 100,
      configurable: true,
    });
    Object.defineProperty(dom.content, "scrollHeight", {
      get: () => 100,
      configurable: true,
    });
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: "content" },
      ],
      initial: "closed",
      animation: "tween",
      duration: 300,
      easing: linear,
      respectReducedMotion: false,
    });
    const sizes: number[] = [];
    engine.on("progress", p => sizes.push(p.size));
    void engine.open("open");
    engine.recompute();
    await wait(600);
    expect(engine.state.size).toBe(420);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!).toBeGreaterThanOrEqual(sizes[i - 1]! - 0.001);
    }
    engine.destroy();
  });
});

describe("visualViewport resizes", () => {
  it("leaves a running close alone when the seat did not move", async () => {
    const vv = installVisualViewport();
    const { engine } = build("full");
    const log = record(engine);
    void engine.close();
    await wait(100);
    vv.dispatchEvent(new Event("resize"));
    await wait(40);
    expect(engine.state.size).toBeGreaterThan(0);
    expect(engine.state.isAnimating).toBe(true);
    await wait(600);
    expect(log).toEqual(["close", "snap", "closed"]);
    engine.destroy();
  });

  it("retargets a running open to the space the keyboard leaves", async () => {
    const vv = installVisualViewport();
    const { engine } = build("closed");
    const log = record(engine);
    void engine.open("full");
    await wait(100);
    vv.height = 500;
    vv.dispatchEvent(new Event("resize"));
    await wait(40);
    expect(engine.state.isAnimating).toBe(true);
    expect(engine.state.size).toBeLessThan(492);
    await wait(700);
    expect(engine.state.size).toBe(492);
    expect(log).toEqual(["open", "snap", "opened"]);
    engine.destroy();
  });

  it("keeps a full sheet full when no keyboard is showing", async () => {
    const vv = installVisualViewport();
    const { engine } = build("full", {
      duration: 0,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: "full" },
      ],
    });
    expect(engine.state.size).toBe(1000);
    vv.dispatchEvent(new Event("resize"));
    await wait(40);
    expect(engine.state.size).toBe(1000);
    engine.destroy();
  });

  it("marks a sheet that lands closed through a resize as resting closed", async () => {
    const vv = installVisualViewport();
    const { dom, engine } = build("full");
    void engine.close();
    await wait(100);
    vv.height = 500;
    vv.dispatchEvent(new Event("resize"));
    await wait(700);
    expect(engine.state.size).toBe(0);
    expect(dom.sheet.getAttribute("data-bs-rest")).toBe("closed");
    engine.destroy();
  });

  it("still closes a view-transition sheet when the viewport shrinks mid-transition", async () => {
    const vv = installVisualViewport();
    (document as unknown as { startViewTransition: unknown }).startViewTransition = (
      apply: () => void,
    ) => {
      apply();
      return {
        finished: new Promise<void>(r => setTimeout(r, 200)),
        ready: Promise.resolve(),
        skipTransition: () => {},
      };
    };
    const { engine } = build("full", { viewTransitions: true });
    const log = record(engine);
    const closing = engine.close();
    await wait(60);
    vv.height = 500;
    vv.dispatchEvent(new Event("resize"));
    await closing;
    await wait(300);
    expect(log).toEqual(["close", "snap", "closed"]);
    expect(engine.state.phase).toBe("closed");
    expect(document.body.style.position).toBe("");
    engine.destroy();
  });
});

describe("a view transition in flight", () => {
  it("reports the sheet as animating until the transition is over", async () => {
    (document as unknown as { startViewTransition: unknown }).startViewTransition = (
      apply: () => void,
    ) => {
      setTimeout(apply, 20);
      return {
        finished: new Promise<void>(r => setTimeout(r, 120)),
        ready: Promise.resolve(),
        skipTransition: () => {},
      };
    };
    const { engine } = build("half", { viewTransitions: true });
    const moving = engine.snapTo("full");
    expect(engine.state.isAnimating).toBe(true);
    await wait(60);
    expect(engine.state.size).toBe(800);
    expect(engine.state.isAnimating).toBe(true);
    await moving;
    expect(engine.state.isAnimating).toBe(false);
    engine.destroy();
  });
});

describe("a tab that goes to the background mid-transition", () => {
  it("lands a closing sheet closed, with nothing left dimming the page", async () => {
    const { dom, engine } = build("full");
    const log = record(engine);
    void engine.close();
    await wait(100);
    setHidden(true);
    expect(engine.state.size).toBe(0);
    expect(engine.state.phase).toBe("closed");
    expect(engine.state.isAnimating).toBe(false);
    expect(dom.sheet.getAttribute("data-bs-rest")).toBe("closed");
    expect(dom.backdrop.style.opacity).toBe("0");
    expect(dom.backdrop.style.pointerEvents).toBe("none");
    expect(document.body.style.position).toBe("");
    expect(log).toEqual(["close", "snap", "closed"]);
    await wait(500);
    expect(log).toEqual(["close", "snap", "closed"]);
    engine.destroy();
  });

  it("lands an opening sheet on its snap", async () => {
    const { engine } = build("closed");
    const log = record(engine);
    void engine.open("full");
    await wait(100);
    setHidden(true);
    expect(engine.state.size).toBe(800);
    expect(engine.state.phase).toBe("open");
    expect(log).toEqual(["open", "snap", "opened"]);
    engine.destroy();
  });
});
