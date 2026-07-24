import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";
import { makeDom } from "./_helpers/makeDom";

const tween = {
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
};

const points = [
  { id: "closed", size: 0 },
  { id: "half", size: 300 },
  { id: "full", size: 600 },
];

const stub = (el: HTMLElement): void => {
  Object.assign(el, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
};

const pointer = (
  target: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  clientY: number,
  pointerId = 1,
): void => {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId,
      pointerType: "touch",
      bubbles: true,
      cancelable: true,
      clientY,
    } as PointerEventInit),
  );
};

const setScrollTop = (el: HTMLElement, v: number): void => {
  Object.defineProperty(el, "scrollTop", {
    value: v,
    writable: true,
    configurable: true,
  });
};

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  __resetRouteCoordinatorForTests();
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
});

describe("drag hardening — surface switching", () => {
  it("setDragFrom mid-drag leaves no stuck drag state", () => {
    const dom = makeDom();
    stub(dom.sheet);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    pointer(dom.handle, "pointerdown", 100);
    pointer(dom.handle, "pointermove", 200);
    expect(engine.state.isDragging).toBe(true);

    engine.setDragFrom("sheet");
    expect(engine.state.isDragging).toBe(false);
    expect(dom.root.getAttribute("data-dragging")).toBeNull();
    engine.destroy();
  });

  it("repeated switching balances every listener it added", () => {
    const dom = makeDom();
    stub(dom.sheet);
    const balance = new Map<string, number>();
    const add = dom.sheet.addEventListener.bind(dom.sheet);
    const remove = dom.sheet.removeEventListener.bind(dom.sheet);
    dom.sheet.addEventListener = ((t: string, ...rest: unknown[]) => {
      balance.set(t, (balance.get(t) ?? 0) + 1);
      return add(t, ...(rest as [never]));
    }) as typeof dom.sheet.addEventListener;
    dom.sheet.removeEventListener = ((t: string, ...rest: unknown[]) => {
      balance.set(t, (balance.get(t) ?? 0) - 1);
      return remove(t, ...(rest as [never]));
    }) as typeof dom.sheet.removeEventListener;

    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    for (let i = 0; i < 12; i++) {
      engine.setDragFrom(i % 2 === 0 ? "sheet" : "handle");
    }
    engine.destroy();
    expect([...balance.entries()].filter(([, n]) => n !== 0)).toEqual([]);
  });

  it("leaving handle mode restores the handle's own touch-action", () => {
    const dom = makeDom();
    stub(dom.sheet);
    dom.handle.style.touchAction = "manipulation";
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    expect(dom.handle.style.touchAction).toBe("pan-x");
    engine.setDragFrom("sheet");
    expect(dom.handle.style.touchAction).toBe("manipulation");
    engine.destroy();
  });

  it("a [data-bs-drag] island inside the scroller drags in zones mode", () => {
    const dom = makeDom();
    stub(dom.sheet);
    stub(dom.content);
    setScrollTop(dom.content, 0);
    const island = document.createElement("div");
    island.setAttribute("data-bs-drag", "");
    dom.content.appendChild(island);

    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: points,
      initial: "full",
      dragFrom: "zones",
      ...tween,
    });
    pointer(island, "pointerdown", 100);
    pointer(island, "pointermove", 260);
    expect(engine.state.isDragging).toBe(true);
    expect(engine.state.size).toBeLessThan(600);
    engine.destroy();
  });
});

describe("drag hardening — one gesture at a time", () => {
  it("a content pointer cannot hijack a live handle drag", () => {
    const dom = makeDom();
    stub(dom.sheet);
    stub(dom.content);
    setScrollTop(dom.content, 0);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    pointer(dom.handle, "pointerdown", 500);
    pointer(dom.handle, "pointermove", 520);
    const held = engine.state.size;

    pointer(dom.content, "pointerdown", 100);
    pointer(dom.content, "pointermove", 300);
    expect(engine.state.size).toBe(held);
    engine.destroy();
  });

  it("the handle cannot hijack a live content drag", () => {
    const dom = makeDom();
    stub(dom.sheet);
    stub(dom.content);
    setScrollTop(dom.content, 0);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    pointer(dom.content, "pointerdown", 100);
    pointer(dom.content, "pointermove", 120);
    pointer(dom.content, "pointermove", 300);
    const held = engine.state.size;
    expect(engine.state.isDragging).toBe(true);

    pointer(dom.handle, "pointerdown", 100);
    pointer(dom.handle, "pointermove", 400);
    expect(engine.state.size).toBe(held);
    engine.destroy();
  });

  it("a second finger never steals an in-flight drag", () => {
    const dom = makeDom();
    stub(dom.sheet);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    pointer(dom.handle, "pointerdown", 500, 1);
    pointer(dom.handle, "pointermove", 550, 1);
    const held = engine.state.size;

    pointer(dom.handle, "pointerdown", 100, 2);
    pointer(dom.handle, "pointermove", 900, 2);
    expect(engine.state.size).toBe(held);

    pointer(dom.handle, "pointerup", 550, 1);
    expect(engine.state.isDragging).toBe(false);
    engine.destroy();
  });

  it("a cancelled pending content gesture still allows the next one", () => {
    const dom = makeDom();
    stub(dom.sheet);
    stub(dom.content);
    setScrollTop(dom.content, 0);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    pointer(dom.content, "pointerdown", 100);
    pointer(dom.content, "pointercancel", 100);
    expect(engine.state.isDragging).toBe(false);

    pointer(dom.content, "pointerdown", 100);
    pointer(dom.content, "pointermove", 120);
    pointer(dom.content, "pointermove", 220);
    expect(engine.state.isDragging).toBe(true);
    engine.destroy();
  });

  it("does not double-mount when the scroller is the sheet itself", () => {
    const dom = makeDom();
    stub(dom.sheet);
    setScrollTop(dom.sheet, 0);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.sheet,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    const starts: string[] = [];
    engine.on("dragstart", () => starts.push("start"));
    pointer(dom.sheet, "pointerdown", 100);
    pointer(dom.sheet, "pointermove", 120);
    pointer(dom.sheet, "pointermove", 240);
    expect(starts.length).toBeLessThanOrEqual(1);
    engine.destroy();
  });
});

describe("drag hardening — teardown and rest state", () => {
  it("destroy mid content-drag is silent and leaves the DOM clean", () => {
    const dom = makeDom();
    stub(dom.sheet);
    stub(dom.content);
    setScrollTop(dom.content, 0);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    pointer(dom.content, "pointerdown", 100);
    pointer(dom.content, "pointermove", 120);
    pointer(dom.content, "pointermove", 260);
    expect(engine.state.isDragging).toBe(true);

    expect(() => engine.destroy()).not.toThrow();
    expect(dom.root.getAttribute("data-dragging")).toBeNull();
    expect(() => pointer(dom.content, "pointermove", 400)).not.toThrow();
    expect(() => pointer(dom.content, "pointerup", 400)).not.toThrow();
  });

  it("disabling content drag mid-gesture does not freeze the sheet", () => {
    const dom = makeDom();
    stub(dom.sheet);
    stub(dom.content);
    setScrollTop(dom.content, 0);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    pointer(dom.content, "pointerdown", 100);
    pointer(dom.content, "pointermove", 120);
    pointer(dom.content, "pointermove", 220);
    expect(engine.state.isDragging).toBe(true);

    engine.setDragFromContent(false);
    pointer(dom.content, "pointermove", 320);
    pointer(dom.content, "pointerup", 320);
    expect(engine.state.isDragging).toBe(false);
    expect(dom.root.getAttribute("data-dragging")).toBeNull();
    engine.destroy();
  });

  it("a closed sheet keeps data-bs-rest across recompute and resize", () => {
    const dom = makeDom();
    stub(dom.sheet);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "closed",
      ...tween,
    });
    expect(dom.sheet.getAttribute("data-bs-rest")).toBe("closed");
    engine.recompute();
    window.dispatchEvent(new Event("resize"));
    expect(dom.sheet.getAttribute("data-bs-rest")).toBe("closed");
    engine.destroy();
  });

  it("close() returns focus to the opener even though the sheet goes hidden", async () => {
    const dom = makeDom();
    stub(dom.sheet);
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "closed",
      focusTrap: true,
      returnFocusTo: opener,
      ...tween,
    });
    await engine.open("full");
    const inner = document.createElement("button");
    dom.content.appendChild(inner);
    inner.focus();

    await engine.close();
    expect(dom.sheet.getAttribute("data-bs-rest")).toBe("closed");
    expect(document.activeElement).toBe(opener);
    engine.destroy();
  });

  it("every public setter is inert after destroy", () => {
    const dom = makeDom();
    stub(dom.sheet);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "half",
      ...tween,
    });
    engine.destroy();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => {
      engine.setDragFrom("zones");
      engine.setDragFromContent(false);
      engine.setDisableDrag(true);
      engine.setPersistent(true);
      engine.recompute();
      void engine.snapTo("full");
      void engine.close();
    }).not.toThrow();
    expect(engine.getDragFrom()).toBe("handle");
    warn.mockRestore();
  });
});

describe("drag hardening — churn", () => {
  it("100 open/close round-trips never overlap open and closed", async () => {
    const dom = makeDom();
    stub(dom.sheet);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "closed",
      ...tween,
    });
    const seen: string[] = [];
    engine.on("open", () => seen.push("open"));
    engine.on("closed", () => seen.push("closed"));

    for (let i = 0; i < 100; i++) {
      void engine.open("full");
      void engine.close();
    }
    await new Promise(r => setTimeout(r, 60));
    expect(engine.state.size).toBe(0);
    expect(dom.sheet.getAttribute("data-bs-rest")).toBe("closed");

    let depth = 0;
    for (const e of seen) {
      depth += e === "open" ? 1 : -1;
      expect(depth).toBeLessThanOrEqual(1);
    }
    engine.destroy();
  });

  it("snapTo racing a live drag lands on a real snap", async () => {
    const dom = makeDom();
    stub(dom.sheet);
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "full",
      ...tween,
    });
    pointer(dom.handle, "pointerdown", 100);
    pointer(dom.handle, "pointermove", 200);
    await engine.snapTo("half");
    pointer(dom.handle, "pointerup", 200);
    await new Promise(r => setTimeout(r, 20));
    expect([0, 300, 600]).toContain(engine.state.size);
    expect(engine.state.isDragging).toBe(false);
    engine.destroy();
  });
});
