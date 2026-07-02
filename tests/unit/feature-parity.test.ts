import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";
import { installFocusTrap } from "../../src/core/lifecycle/focusTrap";
import { installContentSwipe } from "../../src/core/features/content-swipe";

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

describe("content-swipe skips snapping when the gesture scrolled the content", () => {
  const fire = (
    el: HTMLElement,
    type: string,
    y: number,
    listKey: "touches" | "changedTouches",
  ) => {
    const ev = new Event(type);
    Object.defineProperty(ev, listKey, { value: [{ clientY: y }] });
    el.dispatchEvent(ev);
  };

  const setup = () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const calls: string[] = [];
    const detach = installContentSwipe({
      container,
      isDragging: () => false,
      isAnimating: () => false,
      getAllowedIds: () => ["half", "full"],
      getActiveId: () => "half",
      snapTo: id => calls.push(id),
    });
    return { container, calls, detach };
  };

  it("swipe up that also scrolled the container does not expand", () => {
    const { container, calls, detach } = setup();
    Object.defineProperty(container, "scrollTop", {
      value: 0,
      writable: true,
      configurable: true,
    });
    fire(container, "touchstart", 500, "touches");
    container.scrollTop = 120;
    fire(container, "touchmove", 300, "touches");
    fire(container, "touchend", 300, "changedTouches");
    expect(calls).toEqual([]);
    detach();
  });

  it("swipe up without content scroll still expands", () => {
    const { container, calls, detach } = setup();
    fire(container, "touchstart", 500, "touches");
    fire(container, "touchmove", 300, "touches");
    fire(container, "touchend", 300, "changedTouches");
    expect(calls).toEqual(["full"]);
    detach();
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
