import { describe, expect, it, beforeEach, vi } from "vitest";
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

const build = (initial: string, extra: Record<string, unknown> = {}) => {
  const dom = makeDom();
  const engine = new BottomSheetEngine({
    element: dom.sheet,
    handle: dom.handle,
    backdrop: dom.backdrop,
    snapPoints: points,
    initial,
    animation: "tween",
    duration: 200,
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

const withoutSnaps = (log: string[]): string[] => log.filter(e => e !== "snap");

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

describe("lifecycle events follow the phase of the sheet", () => {
  it("starts closed and reports the phase in its state", () => {
    const { engine } = build("closed");
    expect(engine.state.phase).toBe("closed");
    engine.destroy();
  });

  it("is born open without announcing anything", () => {
    const { engine } = build("half");
    expect(engine.state.phase).toBe("open");
    expect(document.body.style.position).toBe("fixed");
    engine.destroy();
  });

  it("announces open when the enter starts and opened when it lands", async () => {
    const { engine } = build("closed");
    const log = record(engine);
    const opening = engine.open("full");
    expect(log).toEqual(["open"]);
    expect(engine.state.phase).toBe("opening");
    expect(document.body.style.position).toBe("fixed");
    await opening;
    expect(log).toEqual(["open", "snap", "opened"]);
    expect(engine.state.phase).toBe("open");
    engine.destroy();
  });

  it("announces close when the exit starts and closed when it lands", async () => {
    const { engine } = build("full");
    const log = record(engine);
    const closing = engine.close();
    expect(log).toEqual(["close"]);
    expect(engine.state.phase).toBe("closing");
    expect(document.body.style.position).toBe("fixed");
    await closing;
    expect(log).toEqual(["close", "snap", "closed"]);
    expect(engine.state.phase).toBe("closed");
    expect(document.body.style.position).toBe("");
    engine.destroy();
  });

  it("stays silent when asked to close a sheet that is already closed", async () => {
    const { engine } = build("closed");
    const log = record(engine);
    const beforeClose = vi.fn();
    engine.on("before-close", beforeClose);
    await engine.close();
    await engine.close("escape");
    await engine.snapTo("closed");
    expect(withoutSnaps(log)).toEqual([]);
    expect(beforeClose).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("asks before-close once when close is called again mid-exit", async () => {
    const { engine } = build("full");
    const log = record(engine);
    const beforeClose = vi.fn();
    engine.on("before-close", beforeClose);
    void engine.close("backdrop");
    await wait(40);
    void engine.close("backdrop");
    await wait(400);
    expect(beforeClose).toHaveBeenCalledTimes(1);
    expect(withoutSnaps(log)).toEqual(["close", "closed"]);
    engine.destroy();
  });

  it("ends closed and hidden when open and close arrive in the same tick", async () => {
    const { dom, engine } = build("closed");
    const log = record(engine);
    void engine.open("full");
    void engine.close();
    await wait(400);
    expect(engine.state.size).toBe(0);
    expect(engine.state.activeId).toBe("closed");
    expect(engine.state.phase).toBe("closed");
    expect(engine.state.isAnimating).toBe(false);
    expect(dom.sheet.getAttribute("data-bs-rest")).toBe("closed");
    expect(document.body.style.position).toBe("");
    expect(withoutSnaps(log)).toEqual(["open", "close", "closed"]);
    engine.destroy();
  });

  it("keeps the active snap and the position in step for two snaps in one tick", async () => {
    const { dom, engine } = build("half");
    void engine.snapTo("full");
    void engine.snapTo("half");
    await wait(400);
    expect(engine.state.size).toBe(300);
    expect(engine.state.activeId).toBe("half");
    expect(dom.handle.getAttribute("aria-valuetext")).toBe("half");
    engine.destroy();
  });

  it("announces open again when a close is reversed before it lands", async () => {
    const { engine } = build("full");
    const log = record(engine);
    void engine.close();
    await wait(60);
    await engine.open("full");
    expect(withoutSnaps(log)).toEqual(["close", "open", "opened"]);
    expect(engine.state.phase).toBe("open");
    expect(document.body.style.position).toBe("fixed");
    engine.destroy();
  });

  it("announces close without opened when an open is reversed before it lands", async () => {
    const { engine } = build("closed");
    const log = record(engine);
    void engine.open("full");
    await wait(60);
    await engine.close();
    expect(withoutSnaps(log)).toEqual(["open", "close", "closed"]);
    expect(engine.state.phase).toBe("closed");
    expect(document.body.style.position).toBe("");
    engine.destroy();
  });

  it("moves between two open snaps without touching the phase", async () => {
    const { engine } = build("half");
    const log = record(engine);
    await engine.snapTo("full");
    expect(log).toEqual(["snap"]);
    expect(engine.state.phase).toBe("open");
    engine.destroy();
  });
});
