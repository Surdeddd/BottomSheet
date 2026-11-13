import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";
import { makeDom } from "./_helpers/makeDom";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const linear = (t: number): number => t;

const build = (initial: string) => {
  const dom = makeDom();
  const engine = new BottomSheetEngine({
    element: dom.sheet,
    handle: dom.handle,
    scrollContainer: dom.content,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "peek", size: 200 },
      { id: "full", size: 800 },
    ],
    initial,
    animation: "tween",
    duration: 200,
    easing: linear,
    respectReducedMotion: false,
  });
  return { dom, engine };
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

describe("content scroll position across snaps", () => {
  it("leaves alone what was scrolled while the sheet was opening", async () => {
    const { dom, engine } = build("closed");
    const opening = engine.open("full");
    await wait(60);
    dom.content.scrollTop = 1972;
    await opening;
    await wait(40);
    expect(dom.content.scrollTop).toBe(1972);
    engine.destroy();
  });

  it("does not bring back the position of an earlier open", async () => {
    const { dom, engine } = build("full");
    dom.content.scrollTop = 500;
    await engine.close();
    dom.content.scrollTop = 0;
    await engine.open("full");
    await wait(40);
    expect(dom.content.scrollTop).toBe(0);
    engine.destroy();
  });

  it("puts the position back as soon as a collapsed sheet starts to expand", async () => {
    const { dom, engine } = build("full");
    dom.content.scrollTop = 500;
    const collapsing = engine.snapTo("peek");
    await wait(60);
    dom.content.scrollTop = 0;
    await collapsing;
    const expanding = engine.snapTo("full");
    expect(dom.content.scrollTop).toBe(500);
    await expanding;
    expect(dom.content.scrollTop).toBe(500);
    engine.destroy();
  });
});
