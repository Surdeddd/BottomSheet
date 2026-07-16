import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { measureSheetNatural } from "../../src/core/features/fit-measurement";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";

const layoutOffsetHeight = (el: HTMLElement, natural: () => number): void => {
  Object.defineProperty(el, "offsetHeight", {
    configurable: true,
    get() {
      const h = el.style.height;
      if (h && h !== "auto" && h.endsWith("px")) return parseFloat(h);
      return natural();
    },
  });
};

const makeBareSheet = (): { sheet: HTMLElement; handle: HTMLElement } => {
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  sheet.appendChild(handle);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  document.body.appendChild(sheet);
  return { sheet, handle };
};

const installFakeIntersectionObserver = (): {
  fire: () => void;
  restore: () => void;
} => {
  const original = globalThis.IntersectionObserver;
  const ref: { fire: () => void } = { fire: () => {} };
  class FakeIntersectionObserver {
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
    }
    observe(): void {
      ref.fire = () =>
        this.cb(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  return {
    fire: () => ref.fire(),
    restore: () => {
      globalThis.IntersectionObserver = original;
    },
  };
};

describe("measureSheetNatural — no scrollContainer escapes the pinned height", () => {
  it("pokes past a pinned inline height instead of reading it back", () => {
    const el = document.createElement("section");
    document.body.appendChild(el);
    layoutOffsetHeight(el, () => 400);
    el.style.height = "4px";

    expect(measureSheetNatural(el, undefined, true)).toBe(400);
    expect(el.style.height).toBe("4px");

    document.body.removeChild(el);
  });
});

describe("BottomSheetEngine — initial-open fit self-heal (no scrollContainer)", () => {
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

  it("heals a pre-layout fit measurement to the true size on the next recompute", () => {
    const sheet = document.createElement("section");
    const handle = document.createElement("div");
    sheet.appendChild(handle);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    document.body.appendChild(sheet);

    let natural = 4;
    layoutOffsetHeight(sheet, () => natural);

    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: "fit" },
      ],
      initial: "open",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    expect(engine.state.size).toBe(4);

    natural = 400;
    engine.recompute();

    expect(engine.state.size).toBe(400);
    engine.destroy();
  });
});

describe("BottomSheetEngine — hidden initial-open runs the full open sequence on heal", () => {
  let io: ReturnType<typeof installFakeIntersectionObserver>;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    __resetRouteCoordinatorForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    io = installFakeIntersectionObserver();
  });

  afterEach(() => {
    io.restore();
    vi.restoreAllMocks();
    __resetRouteCoordinatorForTests();
  });

  const bornOpenHidden = (
    natural: () => number,
    extra: Record<string, unknown> = {},
  ): { sheet: HTMLElement; engine: BottomSheetEngine } => {
    const { sheet, handle } = makeBareSheet();
    layoutOffsetHeight(sheet, natural);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: "fit" },
      ],
      initial: "open",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      ...extra,
    });
    return { sheet, engine };
  };

  it("emits exactly one open and one opened, only after reveal", () => {
    let natural = 0;
    const { engine } = bornOpenHidden(() => natural);
    const events: string[] = [];
    engine.on("open", () => events.push("open"));
    engine.on("opened", () => events.push("opened"));

    expect(engine.state.size).toBe(0);
    expect(events).toEqual([]);

    natural = 400;
    io.fire();

    expect(engine.state.size).toBe(400);
    expect(events).toEqual(["open", "opened"]);
    engine.destroy();
  });

  it("does not emit open and stays at 0 for an initial:'closed' hidden fit sheet", () => {
    let natural = 0;
    const { sheet, handle } = makeBareSheet();
    layoutOffsetHeight(sheet, () => natural);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: "fit" },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const events: string[] = [];
    engine.on("open", () => events.push("open"));

    natural = 400;
    io.fire();

    expect(engine.state.size).toBe(0);
    expect(events).toEqual([]);
    engine.destroy();
  });

  it("pushes exactly one closeOnBack marker on heal, and a Back press closes it", async () => {
    const pushSpy = vi.spyOn(history, "pushState");
    vi.spyOn(history, "back").mockImplementation(() => {
      window.dispatchEvent(new Event("popstate"));
    });
    let natural = 0;
    const { engine } = bornOpenHidden(() => natural, { closeOnBack: true });

    natural = 400;
    io.fire();

    const markers = pushSpy.mock.calls.filter(
      call => (call[0] as { __bs?: boolean } | null)?.__bs === true,
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]![0]).toMatchObject({ __bs: true });
    expect(
      (markers[0]![0] as { __bsSheet?: string }).__bsSheet,
    ).toEqual(expect.any(String));

    window.dispatchEvent(new Event("popstate"));
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(engine.state.size).toBe(0);
    engine.destroy();
  });

  it("promotes the healed sheet at heal; a later opened sheet stacks above it", async () => {
    let natural = 0;
    const { engine: healed, sheet: healedSheet } = bornOpenHidden(() => natural);

    const { sheet: normalSheet, handle: normalHandle } = makeBareSheet();
    const normal = new BottomSheetEngine({
      element: normalSheet,
      handle: normalHandle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    natural = 400;
    io.fire();

    expect(parseInt(healedSheet.style.zIndex, 10)).toBeGreaterThan(
      parseInt(normalSheet.style.zIndex, 10),
    );

    await normal.open("open");
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(parseInt(normalSheet.style.zIndex, 10)).toBeGreaterThan(
      parseInt(healedSheet.style.zIndex, 10),
    );

    healed.destroy();
    normal.destroy();
  });

  it("does not double-emit when recompute() runs during an open() animation", async () => {
    const { sheet, handle } = makeBareSheet();
    layoutOffsetHeight(sheet, () => 300);
    const pushSpy = vi.spyOn(history, "pushState");
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: "fit" },
      ],
      initial: "closed",
      closeOnBack: true,
      animation: "tween",
      duration: 40,
      respectReducedMotion: false,
    });
    const events: string[] = [];
    engine.on("open", () => events.push("open"));
    engine.on("opened", () => events.push("opened"));

    const opening = engine.open("open");
    engine.recompute();
    await opening;
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(events.filter(e => e === "open")).toHaveLength(1);
    expect(events.filter(e => e === "opened")).toHaveLength(1);
    const markers = pushSpy.mock.calls.filter(
      call => (call[0] as { __bs?: boolean } | null)?.__bs === true,
    );
    expect(markers).toHaveLength(1);
    engine.destroy();
  });
});
