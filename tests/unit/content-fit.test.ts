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
  Object.defineProperty(content, "offsetHeight", { get: () => BOX });
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

  it("yields to a user who scrolls back up while the sheet is still expanding", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true }, 200);
    await engine.open("half");
    n.content.scrollTop = 1e9;

    const expanding = engine.snapTo("full");
    await sleep(60);
    n.content.scrollTop = 100;
    await expanding;

    expect(n.content.scrollTop).toBe(100);
    engine.destroy();
  });

  it("still holds the end in place if the user scrolls back down mid-flight", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true }, 200);
    await engine.open("half");
    n.content.scrollTop = 1e9;

    const expanding = engine.snapTo("full");
    await sleep(40);
    n.content.scrollTop = 100;
    await sleep(40);
    n.content.scrollTop = 1e9;
    await expanding;

    expect(n.content.scrollTop).toBe(CONTENT - BOX);
    engine.destroy();
  });

  it("re-seats the inset when snap points change under an idle sheet", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");
    expect(insetOf(n.sheet)).toBe(400);

    engine.setSnapPoints([
      { id: "closed", size: 0 },
      { id: "half", size: 400 },
      { id: "full", size: 900 },
    ]);

    expect(insetOf(n.sheet)).toBe(500);
    engine.destroy();
  });

  it("opens from closed with a restored scroll position left intact", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true }, 120);
    n.content.scrollTop = 700;

    await engine.open("full");

    expect(n.content.scrollTop).toBe(700);
    expect(insetOf(n.sheet)).toBe(0);
    engine.destroy();
  });

  it("publishes the axis cap so a footer can follow the visible edge", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");

    expect(n.sheet.style.getPropertyValue("--bs-max-size")).toBe("800px");
    engine.destroy();
  });

  it("publishes how far a footer may rise once the sheet starts to move", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true }, 120);
    await engine.open("half");

    expect(n.sheet.style.getPropertyValue("--bs-footer-lift-max")).toBe(
      `${BOX}px`,
    );
    engine.destroy();
  });

  it("marks the sheet as resting once it settles", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");

    expect(n.sheet.getAttribute("data-bs-fit-content")).toBe("rest");
    engine.destroy();
  });

  it("switches to moving as soon as a drag starts, before the sheet has moved", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");
    let atStart: string | null = null;
    engine.on("dragstart", () => {
      atStart = n.sheet.getAttribute("data-bs-fit-content");
    });

    n.handle.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: 600, pointerId: 1, button: 0 }),
    );
    n.handle.dispatchEvent(
      new PointerEvent("pointermove", { clientY: 560, pointerId: 1 }),
    );
    n.handle.dispatchEvent(
      new PointerEvent("pointerup", { clientY: 560, pointerId: 1 }),
    );

    expect(atStart).toBe("moving");
    engine.destroy();
  });

  it("switches to moving for the length of a motion and back to resting on the snap", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true }, 160);
    await engine.open("half");
    expect(n.sheet.getAttribute("data-bs-fit-content")).toBe("rest");

    const during: (string | null)[] = [];
    engine.on("progress", () =>
      during.push(n.sheet.getAttribute("data-bs-fit-content")),
    );
    await engine.snapTo("full");

    expect(during.length).toBeGreaterThan(2);
    expect(during.slice(0, -1).every(v => v === "moving")).toBe(true);
    expect(n.sheet.getAttribute("data-bs-fit-content")).toBe("rest");
    engine.destroy();
  });

  it("keeps the published cap in step when the snap points change", async () => {
    const n = makeSheet();
    const engine = build(n, { fitContentToSnap: true });
    await engine.open("half");

    engine.setSnapPoints([
      { id: "closed", size: 0 },
      { id: "half", size: 400 },
      { id: "full", size: 900 },
    ]);

    expect(n.sheet.style.getPropertyValue("--bs-max-size")).toBe("900px");
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
    expect(n.sheet.style.getPropertyValue("--bs-max-size")).toBe("");
    expect(n.sheet.style.getPropertyValue("--bs-footer-lift-max")).toBe("");
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

describe("fitContentToSnap with a compositor-driven settle", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  const withFakeSettle = (n: Nodes) => {
    const footer = document.createElement("div");
    footer.className = "bs-footer";
    n.sheet.append(footer);
    let frames: Keyframe[] = [];
    let duration = 0;
    let finish: () => void = () => {};
    const settle = {
      id: "",
      currentTime: 40 as number | null,
      startTime: 1000 as number | null,
      ready: Promise.resolve(),
      playState: "running",
      finished: new Promise<void>(resolve => {
        finish = () => {
          settle.playState = "finished";
          resolve();
        };
      }),
      cancel: vi.fn(),
      effect: {
        getKeyframes: () =>
          frames.map((f, i) => ({
            ...f,
            offset: null,
            computedOffset: i / Math.max(1, frames.length - 1),
          })),
        getTiming: () => ({ duration }),
      },
    };
    Object.assign(n.sheet, {
      animate: (next: Keyframe[], opts: KeyframeAnimationOptions) => {
        frames = next;
        duration = Number(opts.duration);
        return settle;
      },
      getAnimations: () => [settle],
    });
    const follower = {
      currentTime: null as number | null,
      startTime: null as number | null,
      cancel: vi.fn(),
    };
    const calls: { frames: Keyframe[]; opts: KeyframeAnimationOptions }[] = [];
    Object.assign(footer, {
      animate: (next: Keyframe[], opts: KeyframeAnimationOptions) => {
        calls.push({ frames: next, opts });
        return follower;
      },
    });
    return {
      settle,
      follower,
      calls,
      sheetFrames: () => frames,
      duration: () => duration,
      finish: () => finish(),
    };
  };

  it("moves the footer on the same timeline as the sheet", async () => {
    const n = makeSheet();
    const fake = withFakeSettle(n);
    const engine = new BottomSheetEngine({
      element: n.sheet,
      handle: n.handle,
      scrollContainer: n.content,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 400 },
        { id: "full", size: 800 },
      ],
      initial: "half",
      animation: "tween",
      duration: 160,
      respectReducedMotion: false,
      settleAnimation: "waapi",
      fitContentToSnap: true,
    });

    void engine.snapTo("full");
    await sleep(60);

    expect(fake.settle.id).toBe("bs-settle");
    expect(fake.calls).toHaveLength(1);
    const { frames, opts } = fake.calls[0]!;
    const sheetFrames = fake.sheetFrames();
    expect(frames).toHaveLength(sheetFrames.length);
    frames.forEach((frame, i) => {
      const offset = parseFloat(
        /translate3d\(0, (-?[\d.]+)px/.exec(String(sheetFrames[i]!.transform))![1]!,
      );
      expect(frame.transform).toBe(
        `translateY(${-Math.min(Math.max(offset, 0), BOX)}px)`,
      );
    });
    expect(opts.duration).toBe(fake.duration());
    expect(opts.easing).toBe("linear");
    expect(opts.fill).toBe("forwards");
    expect(fake.follower.startTime).toBe(1000);

    fake.finish();
    await sleep(20);
    expect(fake.follower.cancel).toHaveBeenCalled();
    engine.destroy();
  });

  it("never asks for the sheet's animations when the settle runs on the main thread", async () => {
    const n = makeSheet();
    const getAnimations = vi.fn(() => []);
    Object.assign(n.sheet, { getAnimations });
    const engine = new BottomSheetEngine({
      element: n.sheet,
      handle: n.handle,
      scrollContainer: n.content,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 400 },
        { id: "full", size: 800 },
      ],
      initial: "half",
      animation: "tween",
      duration: 160,
      respectReducedMotion: false,
      fitContentToSnap: true,
    });

    void engine.snapTo("full");
    await sleep(60);
    expect(engine.state.isAnimating).toBe(true);
    await sleep(160);

    expect(getAnimations).not.toHaveBeenCalled();
    engine.destroy();
  });
});
