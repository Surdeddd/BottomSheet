import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

const makeDom = () => {
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  const content = document.createElement("div");
  sheet.appendChild(handle);
  sheet.appendChild(content);
  document.body.appendChild(sheet);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { sheet, handle, content };
};

const opts = (n: ReturnType<typeof makeDom>) => ({
  element: n.sheet,
  handle: n.handle,
  scrollContainer: n.content,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "cnt", size: "content" as const },
  ],
  initial: "cnt",
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
});

const nextFrames = () => new Promise(r => setTimeout(r, 60));

describe("BottomSheetEngine — content-size observer (size:'content' auto-adapt)", () => {
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

  it("recomputes when a child is added to the content (MutationObserver path)", async () => {
    const dom = makeDom();
    dom.content.appendChild(document.createElement("p"));
    const engine = new BottomSheetEngine(opts(dom));
    await nextFrames();

    let calls = 0;
    const orig = engine.recompute.bind(engine);
    engine.recompute = () => {
      calls += 1;
      orig();
    };

    dom.content.appendChild(document.createElement("p"));
    await nextFrames();

    expect(calls).toBeGreaterThan(0);
    engine.destroy();
  });

  it("does not install the observer when no fit/content snap is present", async () => {
    const dom = makeDom();
    const engine = new BottomSheetEngine({
      ...opts(dom),
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 400 },
      ],
      initial: "open",
    });
    await nextFrames();

    let calls = 0;
    const orig = engine.recompute.bind(engine);
    engine.recompute = () => {
      calls += 1;
      orig();
    };

    dom.content.appendChild(document.createElement("p"));
    await nextFrames();

    expect(calls).toBe(0);
    engine.destroy();
  });
});
