import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";
import { installFocusTrap } from "../../src/core/lifecycle/focusTrap";
import { decideContentGesture } from "../../src/core/primitives/content-gesture";

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

const basePoints = [
  { id: "closed", size: 0 },
  { id: "half", size: 300 },
  { id: "full", size: 600 },
];

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
});

describe("runtime flag setters", () => {
  it("setPersistent toggles canDismiss at runtime", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: basePoints,
      initial: "half",
      ...tweenOpts,
    });
    expect(engine.canDismiss()).toBe(true);
    engine.setPersistent(true);
    expect(engine.canDismiss()).toBe(false);
    engine.setPersistent(false);
    expect(engine.canDismiss()).toBe(true);
    engine.destroy();
  });

  it("setDisableClose blocks close() until re-enabled", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: basePoints,
      initial: "half",
      ...tweenOpts,
    });
    engine.setDisableClose(true);
    await engine.close();
    expect(engine.state.size).toBe(300);
    engine.setDisableClose(false);
    await engine.close();
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });
});

describe("initialFocus: false focuses the container instead of the first field", () => {
  it("does not auto-focus an input", () => {
    const container = document.createElement("section");
    const input = document.createElement("input");
    container.appendChild(input);
    document.body.appendChild(container);
    const release = installFocusTrap(container, { initialFocus: false });
    expect(document.activeElement).toBe(container);
    expect(document.activeElement).not.toBe(input);
    release();
  });
});

describe("content gestures leave a scrolled container to the browser", () => {
  it("a scrolled container keeps its scroll in both directions", () => {
    expect(
      decideContentGesture({ delta: -80, scrollTop: 120, atMaxSnap: true }),
    ).toBe("scroll");
    expect(
      decideContentGesture({ delta: 80, scrollTop: 120, atMaxSnap: false }),
    ).toBe("scroll");
  });

  it("a container at the top drags the sheet", () => {
    expect(
      decideContentGesture({ delta: -80, scrollTop: 0, atMaxSnap: true }),
    ).toBe("drag");
    expect(
      decideContentGesture({ delta: 80, scrollTop: 0, atMaxSnap: false }),
    ).toBe("drag");
  });

  it("expanding stops at the largest allowed snap", () => {
    expect(
      decideContentGesture({ delta: 80, scrollTop: 0, atMaxSnap: true }),
    ).toBe("scroll");
  });
});

describe("system Back with a cancelled before-close keeps the sheet dismissible by Back", () => {
  it("re-registers the back closer after cancel; next Back closes", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: basePoints,
      initial: "closed",
      closeOnBack: true,
      ...tweenOpts,
    });
    let block = true;
    engine.on("before-close", p => {
      if (block) p.cancel();
    });
    await engine.open("half");
    expect(engine.state.size).toBe(300);

    window.dispatchEvent(new Event("popstate"));
    await new Promise(r => setTimeout(r, 10));
    expect(engine.state.size).toBe(300);

    block = false;
    window.dispatchEvent(new Event("popstate"));
    await new Promise(r => setTimeout(r, 10));
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });
});

describe("before-snap reaches consumers and can cancel", () => {
  it("cancelling before-snap keeps the current snap", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: basePoints,
      initial: "half",
      ...tweenOpts,
    });
    engine.on("before-snap", p => {
      if (p.id === "full") p.cancel();
    });
    await engine.snapTo("full");
    expect(engine.state.activeId).toBe("half");
    await engine.snapTo("closed");
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });
});
