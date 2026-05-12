
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { resolveSheetAnchoredStyle } from "../../src/core/controllers/scrim-controller";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { makeDom } from "./_helpers/makeDom";

const resetGlobals = (): void => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
};

const makeScrim = (): { scrim: HTMLElement; root: HTMLElement } => {
  const root = document.createElement("div");
  root.className = "bs-root";
  const scrim = document.createElement("div");
  scrim.className = "bs-screen";
  root.appendChild(scrim);
  document.body.appendChild(root);
  return { scrim, root };
};

const baseSnapPoints = [
  { id: "closed", size: 0 },
  { id: "min", size: 100 },
  { id: "full", size: 800 },
];

beforeEach(() => {
  resetGlobals();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("BottomSheetEngine — scrim option (preferred name)", () => {
  it("setScrimOverlay injects a .bs-scrim-overlay wrapper as scrim sibling on .bs-root", () => {
    const { sheet, handle } = makeDom();
    const { scrim, root } = makeScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrim,
      snapPoints: baseSnapPoints,
      initial: "min",
      respectReducedMotion: false,
    });

    const btn = document.createElement("button");
    btn.textContent = "x";
    const teardown = engine.setScrimOverlay({
      children: btn,
      position: "top-right",
    });

    const wrapper = root.querySelector(".bs-scrim-overlay") as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.parentElement).toBe(root);
    expect(scrim.querySelector(".bs-scrim-overlay")).toBeNull();
    expect(wrapper!.contains(btn)).toBe(true);
    expect(wrapper!.style.position).toBe("absolute");
    expect(wrapper!.style.top).toBe("16px");
    expect(wrapper!.style.right).toBe("16px");

    teardown();
    expect(root.querySelector(".bs-scrim-overlay")).toBeNull();

    engine.destroy();
  });

  it("setScrim({ color, blur }) writes inline style to the scrim element", () => {
    const { sheet, handle } = makeDom();
    const { scrim } = makeScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrim,
      snapPoints: baseSnapPoints,
      initial: "min",
      respectReducedMotion: false,
    });

    engine.setScrim({ color: "rgba(0,0,0,0.5)", blur: "8px" });

    expect(scrim.style.background).toContain("rgba(0, 0, 0, 0.5)");
    const filter =
      scrim.style.backdropFilter ||
      scrim.style.getPropertyValue("backdrop-filter");
    expect(filter).toBe("blur(8px)");

    engine.destroy();
  });
});

describe("BottomSheetEngine — screenComponent option (deprecated alias)", () => {
  it("setScrimOverlay still injects when only `screenComponent` is provided", () => {
    const { sheet, handle } = makeDom();
    const { scrim, root } = makeScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: scrim,
      snapPoints: baseSnapPoints,
      initial: "min",
      respectReducedMotion: false,
    });

    const btn = document.createElement("button");
    const teardown = engine.setScrimOverlay({
      children: btn,
      position: "bottom-left",
    });

    const wrapper = root.querySelector(".bs-scrim-overlay") as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.parentElement).toBe(root);
    expect(wrapper!.contains(btn)).toBe(true);
    expect(wrapper!.style.bottom).toBe("16px");
    expect(wrapper!.style.left).toBe("16px");

    teardown();
    expect(root.querySelector(".bs-scrim-overlay")).toBeNull();

    engine.destroy();
  });
});

describe("BottomSheetEngine — --bs-size mirror on scrim parent (.bs-root)", () => {
  it("applySize writes --bs-size onto scrim.parentElement", () => {
    const { sheet, handle } = makeDom();
    const { scrim, root } = makeScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrim,
      snapPoints: baseSnapPoints,
      initial: "min",
      respectReducedMotion: false,
    });
    (engine as unknown as { applySize: (n: number) => void }).applySize(420);
    expect(sheet.style.getPropertyValue("--bs-size")).toBe("420px");
    expect(root.style.getPropertyValue("--bs-size")).toBe("420px");
    engine.destroy();
  });
});

type SheetAnchoredCase = {
  mode: "bottom" | "top" | "left" | "right";
  position: "sheet-top-left" | "sheet-top-center" | "sheet-top-right";
  top: string | null;
  bottom: string | null;
  left: string | null;
  right: string | null;
  transform: string | null;
};

const sheetAnchoredCases: SheetAnchoredCase[] = [
  { mode: "bottom", position: "sheet-top-left",   top: null, bottom: null, left: "16px", right: null,   transform: null },
  { mode: "bottom", position: "sheet-top-center", top: null, bottom: null, left: "50%",  right: null,   transform: "translateX(-50%)" },
  { mode: "bottom", position: "sheet-top-right",  top: null, bottom: null, left: null,   right: "16px", transform: null },
  { mode: "top",    position: "sheet-top-left",   top: null, bottom: null, left: "16px", right: null,   transform: null },
  { mode: "top",    position: "sheet-top-center", top: null, bottom: null, left: "50%",  right: null,   transform: "translateX(-50%)" },
  { mode: "top",    position: "sheet-top-right",  top: null, bottom: null, left: null,   right: "16px", transform: null },
  { mode: "left",   position: "sheet-top-left",   top: "16px", bottom: null,   left: null, right: null, transform: null },
  { mode: "left",   position: "sheet-top-center", top: "50%",  bottom: null,   left: null, right: null, transform: "translateY(-50%)" },
  { mode: "left",   position: "sheet-top-right",  top: null,   bottom: "16px", left: null, right: null, transform: null },
  { mode: "right",  position: "sheet-top-left",   top: "16px", bottom: null,   left: null, right: null, transform: null },
  { mode: "right",  position: "sheet-top-center", top: "50%",  bottom: null,   left: null, right: null, transform: "translateY(-50%)" },
  { mode: "right",  position: "sheet-top-right",  top: null,   bottom: "16px", left: null, right: null, transform: null },
];

describe("resolveSheetAnchoredStyle (pure helper) — full 4×3 matrix incl. anchor edge", () => {
  const SIZE_OFFSET = "calc(var(--bs-size, 0px) + 16px)";
  const ANCHOR_CASES: Array<{
    mode: "bottom" | "top" | "left" | "right";
    position: "sheet-top-left" | "sheet-top-center" | "sheet-top-right";
    expected: { top?: string; bottom?: string; left?: string; right?: string; transform?: string };
  }> = [
    { mode: "bottom", position: "sheet-top-left",   expected: { bottom: SIZE_OFFSET, left: "16px" } },
    { mode: "bottom", position: "sheet-top-center", expected: { bottom: SIZE_OFFSET, left: "50%", transform: "translateX(-50%)" } },
    { mode: "bottom", position: "sheet-top-right",  expected: { bottom: SIZE_OFFSET, right: "16px" } },
    { mode: "top",    position: "sheet-top-left",   expected: { top: SIZE_OFFSET, left: "16px" } },
    { mode: "top",    position: "sheet-top-center", expected: { top: SIZE_OFFSET, left: "50%", transform: "translateX(-50%)" } },
    { mode: "top",    position: "sheet-top-right",  expected: { top: SIZE_OFFSET, right: "16px" } },
    { mode: "left",   position: "sheet-top-left",   expected: { left: SIZE_OFFSET, top: "16px" } },
    { mode: "left",   position: "sheet-top-center", expected: { left: SIZE_OFFSET, top: "50%", transform: "translateY(-50%)" } },
    { mode: "left",   position: "sheet-top-right",  expected: { left: SIZE_OFFSET, bottom: "16px" } },
    { mode: "right",  position: "sheet-top-left",   expected: { right: SIZE_OFFSET, top: "16px" } },
    { mode: "right",  position: "sheet-top-center", expected: { right: SIZE_OFFSET, top: "50%", transform: "translateY(-50%)" } },
    { mode: "right",  position: "sheet-top-right",  expected: { right: SIZE_OFFSET, bottom: "16px" } },
  ];

  for (const c of ANCHOR_CASES) {
    it(`mode="${c.mode}" + position="${c.position}" returns correct anchor + cross-axis`, () => {
      expect(resolveSheetAnchoredStyle(c.mode, c.position, "16px")).toEqual(c.expected);
    });
  }

  it("propagates a non-default inset into the calc expression and cross-axis", () => {
    expect(resolveSheetAnchoredStyle("bottom", "sheet-top-right", "24px")).toEqual({
      bottom: "calc(var(--bs-size, 0px) + 24px)",
      right: "24px",
    });
  });
});

describe("BottomSheetEngine — sheet-anchored overlay positions × all modes", () => {
  for (const c of sheetAnchoredCases) {
    it(`mode="${c.mode}" + position="${c.position}" writes correct cross-axis inset + transform`, () => {
      const { sheet, handle } = makeDom();
      const { scrim, root } = makeScrim();
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        scrim,
        mode: c.mode,
        snapPoints: baseSnapPoints,
        initial: "min",
        respectReducedMotion: false,
      });

      const btn = document.createElement("button");
      const teardown = engine.setScrimOverlay({
        children: btn,
        position: c.position,
      });
      const wrapper = root.querySelector(".bs-scrim-overlay") as HTMLElement | null;
      expect(wrapper).not.toBeNull();

      const ws = wrapper!.style;
      expect(ws.top).toBe(c.top ?? "");
      expect(ws.bottom).toBe(c.bottom ?? "");
      expect(ws.left).toBe(c.left ?? "");
      expect(ws.right).toBe(c.right ?? "");
      expect(ws.transform).toBe(c.transform ?? "");
      expect(ws.position).toBe("absolute");
      expect(ws.pointerEvents).toBe("auto");

      teardown();
      engine.destroy();
    });
  }
});

describe("BottomSheetEngine — setScrim batch with enabled:false + range survives re-enable", () => {
  it("range from disabled batch is restored on subsequent enable", () => {
    const { sheet, handle } = makeDom();
    const { scrim } = makeScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrim,
      snapPoints: baseSnapPoints,
      initial: "min",
      respectReducedMotion: false,
    });

    engine.setScrim({ enabled: false, range: [0.1, 0.4] });

    engine.setScrim({ enabled: true });

    (engine as unknown as { applySize: (n: number) => void }).applySize(420);

    expect(scrim.style.opacity).toBe("1");
    engine.destroy();
  });
});

describe("BottomSheetEngine — setScrimOverlay rejects orphan scrim", () => {
  it("warns and returns a no-op teardown when scrim has no parent", () => {
    const { sheet, handle } = makeDom();
    const scrim = document.createElement("div");
    scrim.className = "bs-screen";

    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrim,
      snapPoints: baseSnapPoints,
      initial: "min",
      respectReducedMotion: false,
    });

    const warnCalls: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args);
    };

    let teardown: (() => void) | undefined;
    try {
      const btn = document.createElement("button");
      teardown = engine.setScrimOverlay({ children: btn, position: "top-right" });
    } finally {
      console.warn = originalWarn;
    }

    expect(warnCalls.length).toBe(1);
    expect(String(warnCalls[0]?.[0])).toContain("scrim element has no parent");
    expect(scrim.querySelector(".bs-scrim-overlay")).toBeNull();
    expect(typeof teardown).toBe("function");
    expect(() => teardown!()).not.toThrow();

    engine.destroy();
  });
});

describe("BottomSheetEngine — scrim methods no-op when no scrim DOM is wired", () => {
  it("setScrimOverlay returns a safe teardown and does not throw", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: baseSnapPoints,
      initial: "min",
      respectReducedMotion: false,
    });

    const btn = document.createElement("button");
    let teardown: (() => void) | undefined;
    expect(() => {
      teardown = engine.setScrimOverlay({ children: btn, position: "center" });
    }).not.toThrow();

    expect(document.querySelector(".bs-scrim-overlay")).toBeNull();
    expect(typeof teardown).toBe("function");
    expect(() => teardown!()).not.toThrow();

    engine.destroy();
  });

  it("setScrim({ color, blur }) is a graceful no-op when no scrim is wired", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: baseSnapPoints,
      initial: "min",
      respectReducedMotion: false,
    });

    expect(() =>
      engine.setScrim({ color: "rgba(0,0,0,0.5)", blur: "8px" }),
    ).not.toThrow();

    engine.destroy();
  });
});
