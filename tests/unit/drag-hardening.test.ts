import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
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
  it("100 open/close round-trips keep open and close strictly alternating", async () => {
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
    engine.on("close", () => seen.push("close"));

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
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
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

describe("drag hardening — what the browser would do with the press", () => {
  const native = (
    target: EventTarget,
    type: "dragstart" | "selectstart",
  ): boolean => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };

  const sheetOn = (dom: ReturnType<typeof makeDom>): BottomSheetEngine => {
    stub(dom.sheet);
    stub(dom.content);
    setScrollTop(dom.content, 0);
    return new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      scrollContainer: dom.content,
      snapPoints: points,
      initial: "half",
      ...tween,
    });
  };

  it("does not let a press that drags the sheet become a native drag", () => {
    const dom = makeDom();
    const engine = sheetOn(dom);

    pointer(dom.handle, "pointerdown", 500);

    expect(native(dom.handle, "dragstart")).toBe(true);
    engine.destroy();
  });

  it("leaves a native drag alone before a press and after it", () => {
    const dom = makeDom();
    const engine = sheetOn(dom);
    expect(native(dom.handle, "dragstart")).toBe(false);

    pointer(dom.handle, "pointerdown", 500);
    pointer(dom.handle, "pointerup", 500);

    expect(native(dom.handle, "dragstart")).toBe(false);
    engine.destroy();
  });

  it("leaves a native drag alone while a press on the content is not yet a drag", () => {
    const dom = makeDom();
    const engine = sheetOn(dom);

    pointer(dom.content, "pointerdown", 100);

    expect(native(dom.content, "dragstart")).toBe(false);
    engine.destroy();
  });

  it("starts no selection anywhere on the page once the press has moved", () => {
    const dom = makeDom();
    const engine = sheetOn(dom);
    const elsewhere = document.createElement("p");
    document.body.append(elsewhere);

    pointer(dom.handle, "pointerdown", 500);
    pointer(dom.handle, "pointermove", 480);

    expect(native(dom.handle, "selectstart")).toBe(true);
    expect(native(elsewhere, "selectstart")).toBe(true);
    engine.destroy();
  });

  it("lets a selection start from a press that has not moved, and once it is over", () => {
    const dom = makeDom();
    const engine = sheetOn(dom);
    const elsewhere = document.createElement("p");
    document.body.append(elsewhere);

    pointer(dom.handle, "pointerdown", 500);
    expect(native(dom.handle, "selectstart")).toBe(false);

    pointer(dom.handle, "pointermove", 480);
    pointer(dom.handle, "pointerup", 480);

    expect(native(dom.handle, "selectstart")).toBe(false);
    expect(native(elsewhere, "selectstart")).toBe(false);
    engine.destroy();
  });

  it("leaves a selection alone in a later task, even if the release never came", async () => {
    const dom = makeDom();
    const engine = sheetOn(dom);
    const elsewhere = document.createElement("p");
    document.body.append(elsewhere);

    pointer(dom.handle, "pointerdown", 500);
    pointer(dom.handle, "pointermove", 480);
    await new Promise(resolve => setTimeout(resolve, 5));

    expect(native(elsewhere, "selectstart")).toBe(false);
    expect(native(dom.handle, "selectstart")).toBe(false);
    engine.destroy();
  });

  it("lets a selection start while a press on the content is not yet a drag", () => {
    const dom = makeDom();
    const engine = sheetOn(dom);

    pointer(dom.content, "pointerdown", 100);
    pointer(dom.content, "pointermove", 101);

    expect(native(dom.content, "selectstart")).toBe(false);
    engine.destroy();
  });

  it("starts no selection inside the shadow root the sheet lives in", () => {
    const dom = makeDom();
    const host = document.createElement("div");
    document.body.append(host);
    host.attachShadow({ mode: "open" }).append(dom.backdrop, dom.sheet);
    const engine = sheetOn(dom);

    pointer(dom.handle, "pointerdown", 500);
    pointer(dom.handle, "pointermove", 480);

    expect(native(dom.backdrop, "selectstart")).toBe(true);
    engine.destroy();
  });

  it("takes every listener it put on the page away with the sheet", () => {
    const dom = makeDom();
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const of = (spy: typeof added | typeof removed): number =>
      spy.mock.calls.filter(([type]) => type === "selectstart").length;

    const engine = sheetOn(dom);
    engine.setDragFrom("sheet");
    engine.setDragFrom("handle");
    engine.destroy();

    expect(of(removed)).toBe(of(added));
    added.mockRestore();
    removed.mockRestore();
  });
});

describe("drag hardening — how a press ends and who holds the pointer", () => {
  type Init = PointerEventInit & { at?: number };

  const send = (target: EventTarget, type: string, init: Init = {}): void => {
    const { at, ...rest } = init;
    const event = new PointerEvent(type, {
      pointerId: 1,
      pointerType: "mouse",
      bubbles: true,
      cancelable: true,
      ...rest,
    } as PointerEventInit);
    if (at !== undefined) {
      Object.defineProperty(event, "timeStamp", { value: at });
    }
    target.dispatchEvent(event);
  };

  const mounted = () => {
    const dom = makeDom();
    stub(dom.sheet);
    const taken = vi.fn();
    dom.handle.setPointerCapture = taken;
    const engine = new BottomSheetEngine({
      element: dom.sheet,
      handle: dom.handle,
      snapPoints: points,
      initial: "half",
      ...tween,
    });
    const ends: number[] = [];
    engine.on("dragend", payload => ends.push(payload.velocity));
    let moves = 0;
    engine.on("drag", () => {
      moves += 1;
    });
    return { dom, engine, taken, ends, moved: () => moves };
  };

  const pull = (handle: HTMLElement, kind: "mouse" | "touch"): void => {
    send(handle, "pointerdown", { clientY: 500, pointerType: kind, at: 0 });
    send(handle, "pointermove", { clientY: 480, pointerType: kind, at: 10 });
    send(handle, "pointermove", { clientY: 440, pointerType: kind, at: 20 });
    send(handle, "pointermove", { clientY: 380, pointerType: kind, at: 30 });
  };

  it("carries the speed of the drag when the release comes right after the last move", () => {
    const { dom, engine, ends } = mounted();

    pull(dom.handle, "mouse");
    send(dom.handle, "pointerup", { clientY: 380, at: 40 });

    expect(ends).toHaveLength(1);
    expect(ends[0]).toBeGreaterThan(1);
    engine.destroy();
  });

  it("carries no speed when the pointer rested before it let go", () => {
    const { dom, engine, ends } = mounted();

    pull(dom.handle, "mouse");
    send(dom.handle, "pointerup", { clientY: 380, at: 600 });

    expect(ends).toEqual([0]);
    engine.destroy();
  });

  it("counts a finger as resting sooner than a mouse", () => {
    const finger = mounted();
    pull(finger.dom.handle, "touch");
    send(finger.dom.handle, "pointerup", {
      clientY: 380,
      pointerType: "touch",
      at: 170,
    });
    expect(finger.ends).toEqual([0]);
    finger.engine.destroy();

    const mouse = mounted();
    pull(mouse.dom.handle, "mouse");
    send(mouse.dom.handle, "pointerup", { clientY: 380, at: 170 });
    expect(mouse.ends[0]).toBeGreaterThan(1);
    mouse.engine.destroy();
  });

  it("ends the drag where it was left when a mouse moves with no button held", () => {
    const { dom, engine, ends } = mounted();
    send(dom.handle, "pointerdown", { clientY: 500, buttons: 1 });
    send(dom.handle, "pointermove", { clientY: 450, buttons: 1 });
    expect(engine.state.isDragging).toBe(true);

    send(dom.handle, "pointermove", { clientY: 200, buttons: 0 });

    expect(engine.state.isDragging).toBe(false);
    expect(ends).toEqual([0]);
    expect(engine.state.size).toBeLessThan(500);

    const rested = engine.state.size;
    send(dom.handle, "pointermove", { clientY: 100, buttons: 0 });
    expect(engine.state.size).toBe(rested);
    engine.destroy();
  });

  it("keeps dragging for a stream that never reports a pressed button", () => {
    const { dom, engine } = mounted();
    send(dom.handle, "pointerdown", { clientY: 500 });
    send(dom.handle, "pointermove", { clientY: 450 });
    send(dom.handle, "pointermove", { clientY: 400 });

    expect(engine.state.isDragging).toBe(true);
    expect(engine.state.size).toBe(400);
    engine.destroy();
  });

  it("leaves the pointer of a mouse alone until the press has travelled", () => {
    const { dom, engine, taken } = mounted();

    send(dom.handle, "pointerdown", { clientX: 100, clientY: 500 });
    send(dom.handle, "pointermove", { clientX: 101, clientY: 492 });
    expect(taken).not.toHaveBeenCalled();

    send(dom.handle, "pointermove", { clientX: 101, clientY: 480 });
    expect(taken).toHaveBeenCalledTimes(1);
    expect(taken).toHaveBeenCalledWith(1);

    send(dom.handle, "pointermove", { clientX: 101, clientY: 450 });
    expect(taken).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it("takes the pointer of a mouse on a sideways move as well", () => {
    const { dom, engine, taken } = mounted();

    send(dom.handle, "pointerdown", { clientX: 100, clientY: 500 });
    send(dom.handle, "pointermove", { clientX: 108, clientY: 500 });
    expect(taken).not.toHaveBeenCalled();

    send(dom.handle, "pointermove", { clientX: 120, clientY: 500 });

    expect(taken).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it("takes the pointer of a finger with the press", () => {
    const { dom, engine, taken } = mounted();

    send(dom.handle, "pointerdown", { clientY: 500, pointerType: "touch" });

    expect(taken).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it("follows a mouse that has left the handle before its pointer was taken", () => {
    const { dom, engine, taken } = mounted();
    const elsewhere = document.createElement("p");
    document.body.append(elsewhere);

    send(dom.handle, "pointerdown", { clientY: 500 });
    send(elsewhere, "pointermove", { clientY: 440 });

    expect(engine.state.size).toBe(360);
    expect(taken).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it("ends a press that is let go outside the handle before its pointer was taken", () => {
    const { dom, engine, ends } = mounted();
    const elsewhere = document.createElement("p");
    document.body.append(elsewhere);

    send(dom.handle, "pointerdown", { clientY: 500 });
    send(elsewhere, "pointerup", { clientY: 500 });

    expect(engine.state.isDragging).toBe(false);
    expect(ends).toHaveLength(1);
    engine.destroy();
  });

  it("ignores what another pointer does on the page", () => {
    const { dom, engine } = mounted();
    const elsewhere = document.createElement("p");
    document.body.append(elsewhere);

    send(dom.handle, "pointerdown", { clientY: 500 });
    send(elsewhere, "pointermove", { clientY: 300, pointerId: 2 });
    send(elsewhere, "pointerup", { clientY: 300, pointerId: 2 });

    expect(engine.state.isDragging).toBe(true);
    expect(engine.state.size).toBe(300);
    engine.destroy();
  });

  it("counts a move once, though the page and the handle both hear it", () => {
    const { dom, engine, moved } = mounted();

    send(dom.handle, "pointerdown", { clientY: 500 });
    send(dom.handle, "pointermove", { clientY: 498 });
    send(dom.handle, "pointermove", { clientY: 470 });

    expect(moved()).toBe(2);
    expect(engine.state.size).toBe(330);
    engine.destroy();
  });

  it("leaves the page's pointer listeners balanced when the sheet goes", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const of = (spy: typeof added | typeof removed): string[] =>
      spy.mock.calls.map(([type]) => String(type)).filter(type => type.startsWith("pointer")).sort();

    const { dom, engine } = mounted();
    send(dom.handle, "pointerdown", { clientY: 500 });
    engine.setDragFrom("sheet");
    engine.setDragFrom("handle");
    engine.destroy();

    expect(of(removed)).toEqual(of(added));
    added.mockRestore();
    removed.mockRestore();
  });
});
