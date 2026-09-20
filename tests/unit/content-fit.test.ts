import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { BottomSheetCore } from "../../src/core/BottomSheetCore";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const CONTENT = 3000;
const BOX = 700;

const insetOf = (sheet: HTMLElement): number =>
  parseFloat(sheet.style.getPropertyValue("--bs-content-inset")) || 0;

const makeSheet = () => {
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  const content = document.createElement("div");
  sheet.append(handle, content);
  document.body.appendChild(sheet);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  let top = 0;
  const maxScroll = (): number => Math.max(0, CONTENT + insetOf(sheet) - BOX);
  Object.defineProperty(content, "clientHeight", { get: () => BOX });
  Object.defineProperty(content, "scrollHeight", {
    get: () => CONTENT + insetOf(sheet),
  });
  Object.defineProperty(content, "scrollTop", {
    get: () => Math.min(top, maxScroll()),
    set: (v: number) => {
      top = Math.max(0, Math.min(v, maxScroll()));
    },
  });
  return { sheet, handle, content };
};

type Nodes = ReturnType<typeof makeSheet>;

const build = (
  n: Nodes,
  extra: Record<string, unknown> = {},
  duration = 0,
) =>
  new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    scrollContainer: n.content,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: 400 },
      { id: "full", size: 800 },
    ],
    initial: "closed",
    animation: "tween",
    duration,
    respectReducedMotion: false,
    ...extra,
  });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe("fitContentToSnap", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
    document.body.removeAttribute("style");
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("stays out of the way unless asked for", async () => {
    const n = makeSheet();
    const engine = build(n);
    await engine.open("half");

    expect(n.sheet.hasAttribute("data-bs-fit-content")).toBe(false);
    expect(n.sheet.style.getPropertyValue("--bs-content-inset")).toBe("");
    engine.destroy();
  });

  it("insets the content by the part of the sheet that is off screen", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");

    expect(n.sheet.hasAttribute("data-bs-fit-content")).toBe(true);
    expect(insetOf(n.sheet)).toBe(400);
    engine.destroy();
  });

  it("makes the end of the content reachable at the half snap", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");

    n.content.scrollTop = 1e9;

    const visibleBand = BOX - insetOf(n.sheet);
    const contentEndInBox = CONTENT - n.content.scrollTop;
    expect(contentEndInBox).toBeLessThanOrEqual(visibleBand);
    engine.destroy();
  });

  it("needs no inset at the largest snap", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("full");

    expect(insetOf(n.sheet)).toBe(0);
    engine.destroy();
  });

  it("follows the sheet from one snap to the next", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");
    expect(insetOf(n.sheet)).toBe(400);

    await engine.snapTo("full");
    expect(insetOf(n.sheet)).toBe(0);

    await engine.snapTo("half");
    expect(insetOf(n.sheet)).toBe(400);
    engine.destroy();
  });

  it("keeps content pinned to the end from jumping when the sheet expands", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true }, 160);
    await engine.open("half");
    n.content.scrollTop = 1e9;
    const pinnedAtHalf = n.content.scrollTop;
    expect(pinnedAtHalf).toBe(CONTENT + 400 - BOX);

    const seen: number[] = [];
    engine.on("progress", () => seen.push(n.content.scrollTop));
    let beforeSettle = -1;
    engine.on("snap", () => {
      beforeSettle = seen.at(-1) ?? -1;
    });
    await engine.snapTo("full");
    const afterSettle = n.content.scrollTop;

    expect(seen.length).toBeGreaterThan(2);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!).toBeLessThanOrEqual(seen[i - 1]!);
    }
    expect(afterSettle).toBe(CONTENT - BOX);
    expect(Math.abs(afterSettle - beforeSettle)).toBeLessThan(12);
    engine.destroy();
  });

  it("leaves the scroll position alone when the content is not pinned to the end", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true }, 120);
    await engine.open("half");
    n.content.scrollTop = 900;

    await engine.snapTo("full");

    expect(n.content.scrollTop).toBe(900);
    engine.destroy();
  });

  it("leaves the scroll position alone when the sheet collapses", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true }, 120);
    await engine.open("full");
    n.content.scrollTop = 1e9;
    const pinnedAtFull = n.content.scrollTop;

    await engine.snapTo("half");

    expect(n.content.scrollTop).toBe(pinnedAtFull);
    expect(insetOf(n.sheet)).toBe(400);
    engine.destroy();
  });

  it("does nothing for a sheet that is not on the bottom edge", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true, mode: "top" });
    await engine.open("half");

    expect(insetOf(n.sheet)).toBe(0);
    engine.destroy();
  });

  it("re-measures when the viewport changes under an idle sheet", async () => {
    const n = makeSheet();
    const engine = new BottomSheetEngine({
      element: n.sheet,
      handle: n.handle,
      scrollContainer: n.content,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: "40%" },
        { id: "full", size: "80%" },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      fitContentToSnap: true,
    });
    await engine.open("half");
    expect(insetOf(n.sheet)).toBe(400);

    Object.defineProperty(window, "innerHeight", {
      value: 500,
      configurable: true,
    });
    window.dispatchEvent(new Event("orientationchange"));
    window.dispatchEvent(new Event("resize"));
    await sleep(20);

    expect(insetOf(n.sheet)).toBe(200);
    engine.destroy();
  });

  it("cleans up after itself on destroy", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");

    engine.destroy();

    expect(n.sheet.hasAttribute("data-bs-fit-content")).toBe(false);
    expect(n.sheet.style.getPropertyValue("--bs-content-inset")).toBe("");
  });

  it("warns when the option is set on a core built without the feature", () => {
    const n = makeSheet();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const core = new BottomSheetCore({
      element: n.sheet,
      handle: n.handle,
      scrollContainer: n.content,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 400 },
      ],
      initial: "closed",
      fitContentToSnap: true,
      features: [],
    });

    expect(warn.mock.calls.flat().join(" ")).toContain("fitContentToSnap");
    expect(n.sheet.hasAttribute("data-bs-fit-content")).toBe(false);
    core.destroy();
    warn.mockRestore();
  });
});
