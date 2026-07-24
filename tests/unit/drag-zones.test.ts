import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { isDragAllowedFrom } from "../../src/core/primitives/drag-zones";
import { decideContentGesture } from "../../src/core/primitives/content-gesture";
import { makeDom } from "./_helpers/makeDom";
import type { SnapPointDef } from "../../src/core/types";

const tweenOpts = {
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
};

const stubPointerCapture = (el: HTMLElement) => {
  Object.assign(el, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
};

const setScrollTop = (el: HTMLElement, value: number) => {
  Object.defineProperty(el, "scrollTop", {
    value,
    writable: true,
    configurable: true,
  });
};

const pointer = (
  target: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientY: number,
  pointerType = "touch",
) => {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      pointerType,
      bubbles: true,
      cancelable: true,
      clientY,
    } as PointerEventInit),
  );
};

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
});

describe("isDragAllowedFrom", () => {
  const build = () => {
    const host = document.createElement("div");
    const plain = document.createElement("div");
    const zone = document.createElement("div");
    zone.setAttribute("data-bs-drag", "");
    const blocked = document.createElement("div");
    blocked.setAttribute("data-bs-no-drag", "");
    const blockedInsideZone = document.createElement("div");
    blockedInsideZone.setAttribute("data-bs-no-drag", "");
    zone.appendChild(blockedInsideZone);
    host.append(plain, zone, blocked);
    return { plain, zone, blocked, blockedInsideZone };
  };

  it("handle and sheet modes allow anything outside a no-drag subtree", () => {
    const { plain, blocked } = build();
    expect(isDragAllowedFrom(plain, "handle")).toBe(true);
    expect(isDragAllowedFrom(plain, "sheet")).toBe(true);
    expect(isDragAllowedFrom(blocked, "handle")).toBe(false);
    expect(isDragAllowedFrom(blocked, "sheet")).toBe(false);
  });

  it("zones mode requires an explicit opt-in", () => {
    const { plain, zone } = build();
    expect(isDragAllowedFrom(plain, "zones")).toBe(false);
    expect(isDragAllowedFrom(zone, "zones")).toBe(true);
  });

  it("no-drag wins over an enclosing drag zone", () => {
    const { blockedInsideZone } = build();
    expect(isDragAllowedFrom(blockedInsideZone, "zones")).toBe(false);
    expect(isDragAllowedFrom(blockedInsideZone, "sheet")).toBe(false);
  });

  it("a target without closest() only blocks zones mode", () => {
    expect(isDragAllowedFrom(null, "sheet")).toBe(true);
    expect(isDragAllowedFrom(null, "zones")).toBe(false);
  });
});

describe("decideContentGesture", () => {
  it("waits until the pointer clears the slop", () => {
    expect(
      decideContentGesture({ delta: -3, scrollTop: 0, atMaxSnap: false }),
    ).toBe("pending");
  });

  it("leaves a scrolled container to the browser", () => {
    expect(
      decideContentGesture({ delta: -40, scrollTop: 5, atMaxSnap: true }),
    ).toBe("scroll");
    expect(
      decideContentGesture({ delta: 40, scrollTop: 5, atMaxSnap: false }),
    ).toBe("scroll");
  });

  it("drags the sheet from the top of the scroller", () => {
    expect(
      decideContentGesture({ delta: -40, scrollTop: 0, atMaxSnap: true }),
    ).toBe("drag");
    expect(
      decideContentGesture({ delta: 40, scrollTop: 0, atMaxSnap: false }),
    ).toBe("drag");
  });

  it("does not expand past the largest allowed snap", () => {
    expect(
      decideContentGesture({ delta: 40, scrollTop: 0, atMaxSnap: true }),
    ).toBe("scroll");
  });
});

describe("closed sheets rest without a shadow", () => {
  const points = [
    { id: "closed", size: 0 },
    { id: "full", size: 600 },
  ];

  it("marks a sheet that mounts closed", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: points,
      initial: "closed",
      ...tweenOpts,
    });
    expect(sheet.getAttribute("data-bs-rest")).toBe("closed");
    engine.destroy();
  });

  it("clears the mark while open and restores it after close", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: points,
      initial: "closed",
      ...tweenOpts,
    });
    await engine.open("full");
    expect(sheet.getAttribute("data-bs-rest")).toBeNull();
    await engine.close();
    expect(sheet.getAttribute("data-bs-rest")).toBe("closed");
    engine.destroy();
  });

  it("does not mark a sheet that mounts open", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: points,
      initial: "full",
      ...tweenOpts,
    });
    expect(sheet.getAttribute("data-bs-rest")).toBeNull();
    engine.destroy();
  });

  it("drops the mark on destroy so the element is left usable", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: points,
      initial: "closed",
      ...tweenOpts,
    });
    engine.destroy();
    expect(sheet.getAttribute("data-bs-rest")).toBeNull();
  });
});

describe("drag from content", () => {
  const points = [
    { id: "closed", size: 0 },
    { id: "half", size: 300 },
    { id: "full", size: 600 },
  ];

  const setup = (
    opts: Record<string, unknown> = {},
    snapPoints: SnapPointDef[] = points,
  ) => {
    const dom = makeDom();
    stubPointerCapture(dom.sheet);
    stubPointerCapture(dom.content);
    setScrollTop(dom.content, 0);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints,
      initial: "full",
      ...tweenOpts,
      ...opts,
    });
    return { ...dom, engine };
  };

  it("follows the finger down and settles on the smaller snap", async () => {
    const { content, engine } = setup();
    pointer(content, "pointerdown", 100);
    pointer(content, "pointermove", 120);
    pointer(content, "pointermove", 300);
    expect(engine.state.size).toBe(600 - 180);
    pointer(content, "pointerup", 300);
    await new Promise(r => setTimeout(r, 10));
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("emits drag events like the handle gesture does", () => {
    const { content, engine } = setup();
    const seen: string[] = [];
    engine.on("dragstart", () => seen.push("dragstart"));
    engine.on("dragend", () => seen.push("dragend"));
    pointer(content, "pointerdown", 100);
    pointer(content, "pointermove", 120);
    pointer(content, "pointermove", 200);
    pointer(content, "pointerup", 200);
    expect(seen).toEqual(["dragstart", "dragend"]);
    engine.destroy();
  });

  it("leaves a scrolled container alone", () => {
    const { content, engine } = setup();
    setScrollTop(content, 140);
    pointer(content, "pointerdown", 100);
    pointer(content, "pointermove", 120);
    pointer(content, "pointermove", 300);
    expect(engine.state.size).toBe(600);
    expect(engine.state.isDragging).toBe(false);
    engine.destroy();
  });

  it("ignores mouse pointers so wheel scrolling keeps working", () => {
    const { content, engine } = setup();
    pointer(content, "pointerdown", 100, "mouse");
    pointer(content, "pointermove", 120, "mouse");
    pointer(content, "pointermove", 300, "mouse");
    expect(engine.state.size).toBe(600);
    engine.destroy();
  });

  it("respects dragFromContent: false on the engine", () => {
    const { content, engine } = setup({ dragFromContent: false });
    pointer(content, "pointerdown", 100);
    pointer(content, "pointermove", 120);
    pointer(content, "pointermove", 300);
    expect(engine.state.size).toBe(600);
    engine.destroy();
  });

  it("respects dragFromContent: false on the active snap point only", async () => {
    const { content, engine } = setup({}, [
      { id: "closed", size: 0 },
      { id: "half", size: 300 },
      { id: "full", size: 600, dragFromContent: false },
    ]);
    pointer(content, "pointerdown", 100);
    pointer(content, "pointermove", 120);
    pointer(content, "pointermove", 300);
    expect(engine.state.size).toBe(600);

    await engine.snapTo("half");
    pointer(content, "pointerdown", 100);
    pointer(content, "pointermove", 120);
    pointer(content, "pointermove", 200);
    expect(engine.state.size).toBeLessThan(300);
    engine.destroy();
  });

  it("setDragFromContent flips the gate at runtime", () => {
    const { content, engine } = setup({ dragFromContent: false });
    engine.setDragFromContent(true);
    pointer(content, "pointerdown", 100);
    pointer(content, "pointermove", 120);
    pointer(content, "pointermove", 300);
    expect(engine.state.size).toBe(600 - 180);
    engine.destroy();
  });

  it("disableDrag blocks the content gesture too", () => {
    const { content, engine } = setup({ disableDrag: true });
    pointer(content, "pointerdown", 100);
    pointer(content, "pointermove", 120);
    pointer(content, "pointermove", 300);
    expect(engine.state.size).toBe(600);
    engine.destroy();
  });
});

describe("dragFrom zones", () => {
  const points = [
    { id: "half", size: 300 },
    { id: "full", size: 600 },
  ];

  it("only starts from an opted-in zone, and always from the handle", () => {
    const dom = makeDom();
    stubPointerCapture(dom.sheet);
    const zone = document.createElement("div");
    zone.setAttribute("data-bs-drag", "");
    const plain = document.createElement("div");
    dom.sheet.append(zone, plain);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      dragFrom: "zones",
      ...tweenOpts,
    });

    pointer(plain, "pointerdown", 100);
    pointer(plain, "pointermove", 200);
    expect(engine.state.isDragging).toBe(false);

    pointer(zone, "pointerdown", 100);
    pointer(zone, "pointermove", 200);
    expect(engine.state.isDragging).toBe(true);
    pointer(zone, "pointerup", 200);

    pointer(dom.handle, "pointerdown", 100);
    pointer(dom.handle, "pointermove", 200);
    expect(engine.state.isDragging).toBe(true);
    pointer(dom.handle, "pointerup", 200);
    engine.destroy();
  });

  it("setDragFrom moves the gesture between surfaces at runtime", () => {
    const dom = makeDom();
    stubPointerCapture(dom.sheet);
    const plain = document.createElement("div");
    dom.sheet.appendChild(plain);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      ...tweenOpts,
    });
    expect(engine.getDragFrom()).toBe("handle");

    // handle mode: the sheet body does not drag
    pointer(plain, "pointerdown", 100);
    pointer(plain, "pointermove", 200);
    expect(engine.state.isDragging).toBe(false);

    engine.setDragFrom("sheet");
    expect(engine.getDragFrom()).toBe("sheet");
    pointer(plain, "pointerdown", 100);
    pointer(plain, "pointermove", 200);
    expect(engine.state.isDragging).toBe(true);
    pointer(plain, "pointerup", 200);

    // and back off again
    engine.setDragFrom("handle");
    pointer(plain, "pointerdown", 100);
    pointer(plain, "pointermove", 200);
    expect(engine.state.isDragging).toBe(false);
    engine.destroy();
  });

  it("setDragFrom is a no-op for the current mode and after destroy", () => {
    const dom = makeDom();
    stubPointerCapture(dom.sheet);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      ...tweenOpts,
    });
    engine.setDragFrom("handle");
    expect(engine.getDragFrom()).toBe("handle");
    engine.destroy();
    engine.setDragFrom("sheet");
    expect(engine.getDragFrom()).toBe("handle");
  });

  it("data-bs-no-drag opts a subtree out in sheet mode", () => {
    const dom = makeDom();
    stubPointerCapture(dom.sheet);
    const blocked = document.createElement("div");
    blocked.setAttribute("data-bs-no-drag", "");
    dom.sheet.appendChild(blocked);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      dragFrom: "sheet",
      ...tweenOpts,
    });

    pointer(blocked, "pointerdown", 100);
    pointer(blocked, "pointermove", 200);
    expect(engine.state.isDragging).toBe(false);
    engine.destroy();
  });
});
