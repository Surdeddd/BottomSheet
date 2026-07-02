import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import {
  lockBodyScroll,
  __resetScrollLockForTests,
} from "../../src/core/lifecycle/scrollLock";
import { installFocusTrap } from "../../src/core/lifecycle/focusTrap";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

const makeDom = () => {
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

const tweenOpts = {
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
};

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

describe("close()/open() fallbacks resolve by size, not by name or order", () => {
  it("close() without a 'closed' id lands on the size-0 snap even when it is not first", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "half", size: 300 },
        { id: "gone", size: 0 },
      ],
      initial: "half",
      ...tweenOpts,
    });
    await engine.close();
    expect(engine.state.size).toBe(0);
    expect(engine.state.activeId).toBe("gone");
    engine.destroy();
  });

  it("open() skips size-0 snaps regardless of their name", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "hidden", size: 0 },
        { id: "half", size: 300 },
      ],
      initial: "hidden",
      ...tweenOpts,
    });
    await engine.open();
    expect(engine.state.activeId).toBe("half");
    expect(engine.state.size).toBe(300);
    engine.destroy();
  });
});

describe("string maxHeight re-resolves on viewport resize", () => {
  it("'50%' cap follows innerHeight changes", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 900 },
      ],
      initial: "closed",
      maxHeight: "50%",
      ...tweenOpts,
    });
    await engine.open("open");
    expect(engine.state.size).toBe(500);
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    window.dispatchEvent(new Event("orientationchange"));
    await new Promise(r => setTimeout(r, 30));
    expect(engine.state.size).toBe(400);
    engine.destroy();
  });
});

describe("will-change does not leak", () => {
  it("snapTo to the current snap releases a stale will-change promotion", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 300 },
      ],
      initial: "open",
      ...tweenOpts,
    });
    sheet.style.willChange = "transform";
    await engine.snapTo("open");
    expect(sheet.style.willChange).toBe("");
    engine.destroy();
  });
});

describe("SnapResolver memoizes fit measurement per recompute pass", () => {
  it("two fit snaps trigger a single measurement", () => {
    const { sheet, handle } = makeDom();
    const content = document.createElement("div");
    sheet.appendChild(content);
    let reads = 0;
    Object.defineProperty(sheet, "offsetHeight", {
      configurable: true,
      get() {
        reads += 1;
        return 400;
      },
    });
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [
        { id: "a", size: "fit" },
        { id: "b", size: "content" },
      ],
      initial: "a",
      ...tweenOpts,
    });
    expect(reads).toBe(1);
    engine.recompute();
    expect(reads).toBe(2);
    engine.destroy();
  });
});

describe("scroll lock compensates the scrollbar gutter", () => {
  it("adds the innerWidth/clientWidth gap as body padding and restores it", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1009,
      configurable: true,
    });
    const release = lockBodyScroll();
    expect(document.body.style.paddingRight).toBe("15px");
    release();
    expect(document.body.style.paddingRight).toBe("");
  });
});

describe("focus trap sees slotted (light-DOM) content through shadow boundaries", () => {
  it("initial focus reaches a slotted button and focusin does not yank focus from it", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const container = document.createElement("section");
    const slot = document.createElement("slot");
    container.appendChild(slot);
    shadow.appendChild(container);
    const slottedButton = document.createElement("button");
    slottedButton.textContent = "slotted";
    host.appendChild(slottedButton);
    const outside = document.createElement("button");
    document.body.appendChild(outside);

    const release = installFocusTrap(container);
    expect(document.activeElement).toBe(slottedButton);

    slottedButton.dispatchEvent(
      new FocusEvent("focusin", { bubbles: true, composed: true }),
    );
    expect(document.activeElement).toBe(slottedButton);

    outside.focus();
    outside.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(document.activeElement).toBe(slottedButton);
    release();
  });
});

describe("destroy() removes engine-written custom properties from hosts", () => {
  it("clears --bs-size/--bs-progress from the root element", async () => {
    const root = document.createElement("div");
    root.className = "bs-root";
    document.body.appendChild(root);
    const sheet = document.createElement("section");
    const handle = document.createElement("div");
    sheet.appendChild(handle);
    root.appendChild(sheet);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 300 },
      ],
      initial: "closed",
      ...tweenOpts,
    });
    await engine.open("open");
    expect(root.style.getPropertyValue("--bs-size")).toBe("300px");
    engine.destroy();
    expect(root.style.getPropertyValue("--bs-size")).toBe("");
    expect(root.style.getPropertyValue("--bs-progress")).toBe("");
  });
});

describe("visualViewport cancels an in-flight animation before re-clamping (keyboard resize mid-animation)", () => {
  const originalVv = Object.getOwnPropertyDescriptor(window, "visualViewport");

  afterEach(() => {
    if (originalVv) {
      Object.defineProperty(window, "visualViewport", originalVv);
    } else {
      delete (window as unknown as { visualViewport?: unknown }).visualViewport;
    }
  });

  it("a keyboard shrink mid-tween cancels the tween and settles at the clamped viewport, not the target snap", async () => {
    let vvListener: (() => void) | null = null;
    const vv = {
      height: 1000,
      width: 1000,
      addEventListener: (_type: string, fn: () => void) => {
        vvListener = fn;
      },
      removeEventListener: () => {},
    };
    Object.defineProperty(window, "visualViewport", {
      value: vv,
      configurable: true,
    });

    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 300 },
        { id: "open", size: 900 },
      ],
      initial: "half",
      animation: "tween" as const,
      duration: 300,
      respectReducedMotion: false,
    });

    const settle = engine.snapTo("open");
    await new Promise(r => setTimeout(r, 20));
    expect(engine.state.isAnimating).toBe(true);

    vv.height = 400;
    expect(vvListener).not.toBeNull();
    vvListener!();
    await new Promise(r => setTimeout(r, 40));
    await settle;

    expect(engine.state.isAnimating).toBe(false);
    expect(engine.state.size).toBe(392);
    expect(sheet.style.getPropertyValue("--bs-size")).toBe("392px");
    engine.destroy();
  });
});
