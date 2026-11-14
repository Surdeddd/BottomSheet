import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";
import { makeDom } from "./_helpers/makeDom";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const points = [
  { id: "closed", size: 0 },
  { id: "half", size: 300 },
  { id: "full", size: 800 },
];

const build = (extra: Record<string, unknown>) => {
  const dom = makeDom();
  const engine = new BottomSheetEngine({
    element: dom.sheet,
    handle: dom.handle,
    snapPoints: points,
    initial: "half",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
    ...extra,
  });
  return { dom, engine };
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

const dragDown = (handle: HTMLElement): void => {
  pointer(handle, "pointerdown", 700);
  pointer(handle, "pointermove", 800);
  pointer(handle, "pointermove", 900);
  pointer(handle, "pointermove", 990);
  pointer(handle, "pointerup", 990);
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
});

afterEach(() => {
  __resetRouteCoordinatorForTests();
  vi.restoreAllMocks();
});

describe("persistent", () => {
  it("survives a hardware Back press and keeps its history marker", async () => {
    const pushSpy = vi.spyOn(history, "pushState");
    vi.spyOn(history, "back").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const { engine } = build({ persistent: true, closeOnBack: true });
    const pushesWhileOpen = pushSpy.mock.calls.length;
    expect(pushesWhileOpen).toBeGreaterThan(0);

    window.dispatchEvent(new PopStateEvent("popstate"));
    await wait(40);

    expect(engine.state.size).toBe(300);
    expect(engine.state.activeId).toBe("half");
    expect(pushSpy.mock.calls.length).toBe(pushesWhileOpen + 1);
    engine.destroy();
  });

  it("still closes when the app asks for it", async () => {
    const { engine } = build({ persistent: true });
    await engine.close();
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });

  it("does not let a drag carry the sheet to a closed snap", async () => {
    const { dom, engine } = build({ persistent: true });
    dragDown(dom.handle);
    await wait(60);
    expect(engine.state.size).toBe(300);
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("does not let the slider keys reach a closed snap", async () => {
    const { dom, engine } = build({ persistent: true });
    dom.handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    dom.handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await wait(40);
    expect(engine.state.size).toBe(300);
    engine.destroy();
  });

  it("still lets the user move between open snaps", async () => {
    const { dom, engine } = build({ persistent: true });
    dom.handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    await wait(40);
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });

  it("lets the user close again once it is switched off", async () => {
    const { dom, engine } = build({ persistent: true });
    engine.setPersistent(false);
    dragDown(dom.handle);
    await wait(60);
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });
});

describe("open() and close() targets", () => {
  it("open() leaves an open sheet where it is", async () => {
    const { engine } = build({ initial: "full" });
    await engine.open();
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });

  it("open() with an id still moves an open sheet", async () => {
    const { engine } = build({ initial: "full" });
    await engine.open("half");
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("open() opens a closed sheet at its first open snap", async () => {
    const { engine } = build({ initial: "closed" });
    await engine.open();
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("close() without a closed snap goes to the smallest snap, whatever the order", async () => {
    const { engine } = build({
      snapPoints: [
        { id: "tall", size: 800 },
        { id: "mid", size: 500 },
        { id: "low", size: 200 },
      ],
      allowed: ["tall", "mid", "low"],
      initial: "mid",
    });
    await engine.close();
    expect(engine.state.activeId).toBe("low");
    engine.destroy();
  });
});

describe("disableClose", () => {
  it("does not let a drag carry the sheet to a closed snap", async () => {
    const { dom, engine } = build({ disableClose: true });
    dragDown(dom.handle);
    await wait(60);
    expect(engine.state.size).toBe(300);
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("does not let the slider keys reach a closed snap", async () => {
    const { dom, engine } = build({ disableClose: true });
    dom.handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    dom.handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await wait(40);
    expect(engine.state.size).toBe(300);
    engine.destroy();
  });

  it("refuses snapTo and setAllowed that target a closed snap", async () => {
    const { engine } = build({ disableClose: true });
    await engine.snapTo("closed");
    expect(engine.state.size).toBe(300);
    engine.setAllowed(["closed", "half", "full"], "closed");
    await wait(40);
    expect(engine.state.size).toBe(300);
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("lets everything through again once it is switched off", async () => {
    const { engine } = build({ disableClose: true });
    engine.setDisableClose(false);
    await engine.snapTo("closed");
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });

  it("still lets the sheet move between open snaps", async () => {
    const { dom, engine } = build({ disableClose: true });
    dom.handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    await wait(40);
    expect(engine.state.size).toBe(800);
    engine.destroy();
  });
});
