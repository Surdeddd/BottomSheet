import { describe, expect, it, beforeEach, vi } from "vitest";
import { OverlayEngine, createOverlay } from "../../src/core/overlay";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";

const makeDom = () => {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  const panel = document.createElement("section");
  const backdrop = document.createElement("div");
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
  return { panel, backdrop };
};

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
});

describe("OverlayEngine", () => {
  it("starts hidden with closed transform", () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0 });
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(panel.getAttribute("data-state")).toBe("closed");
    expect(panel.style.transform).toContain("translate3d(0, 100%, 0)");
    ovl.destroy();
  });

  it("open() removes hidden and sets data-state=open after transition", async () => {
    const { panel, backdrop } = makeDom();
    const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
    await ovl.open();
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(panel.getAttribute("data-state")).toBe("open");
    expect(panel.style.transform).toContain("translate3d(0, 0, 0)");
    expect(backdrop.style.opacity).toBe("1");
    ovl.destroy();
  });

  it("close() restores hidden + closed transform", async () => {
    const { panel, backdrop } = makeDom();
    const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
    await ovl.open();
    await ovl.close();
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(panel.getAttribute("data-state")).toBe("closed");
    expect(panel.style.transform).toContain("translate3d(0, 100%, 0)");
    expect(backdrop.style.opacity).toBe("0");
    ovl.destroy();
  });

  it("open() is idempotent — second call no-ops", async () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0 });
    const onOpen = vi.fn();
    ovl.on("open", onOpen);
    await ovl.open();
    await ovl.open();
    expect(onOpen).toHaveBeenCalledTimes(1);
    ovl.destroy();
  });

  it("close() is idempotent — calling on closed overlay no-ops", async () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0 });
    const onClose = vi.fn();
    ovl.on("close", onClose);
    await ovl.close();
    expect(onClose).not.toHaveBeenCalled();
    ovl.destroy();
  });

  it("destroy() releases stack entry without throwing", () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0 });
    expect(() => ovl.destroy()).not.toThrow();
    expect(() => ovl.destroy()).not.toThrow();
  });

  it("destroy() during in-flight open() resolves the promise (no hang)", async () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 50 });
    const openPromise = ovl.open();
    ovl.destroy();
    await Promise.race([
      openPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 500)),
    ]);
  });

  it("toggle() flips between open and closed", async () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0 });
    expect(ovl.state.isOpen).toBe(false);
    await ovl.toggle();
    expect(ovl.state.isOpen).toBe(true);
    await ovl.toggle();
    expect(ovl.state.isOpen).toBe(false);
    ovl.destroy();
  });

  it("emits before-open and before-close events", async () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0 });
    const before = vi.fn();
    ovl.on("before-open", before);
    await ovl.open();
    expect(before).toHaveBeenCalled();
    const beforeClose = vi.fn();
    ovl.on("before-close", beforeClose);
    await ovl.close();
    expect(beforeClose).toHaveBeenCalled();
    ovl.destroy();
  });

  it("createOverlay factory returns a working engine", async () => {
    const { panel } = makeDom();
    const ovl = createOverlay({ element: panel, duration: 0 });
    await ovl.open();
    expect(ovl.state.isOpen).toBe(true);
    ovl.destroy();
  });

  it("edge:'top' uses translate3d(0, -100%, 0) closed transform", () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, edge: "top", duration: 0 });
    expect(panel.style.transform).toContain("translate3d(0, -100%, 0)");
    ovl.destroy();
  });

  it("edge:'left' uses translate3d(-100%, 0, 0) closed transform", () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, edge: "left", duration: 0 });
    expect(panel.style.transform).toContain("translate3d(-100%, 0, 0)");
    ovl.destroy();
  });

  it("edge:'right' uses translate3d(100%, 0, 0) closed transform", () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, edge: "right", duration: 0 });
    expect(panel.style.transform).toContain("translate3d(100%, 0, 0)");
    ovl.destroy();
  });

  it("initialOpen:true opens immediately on construction", async () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, initialOpen: true, duration: 0 });
    await new Promise(r => setTimeout(r, 30));
    expect(ovl.state.isOpen).toBe(true);
    ovl.destroy();
  });

  it("destroy() during in-flight close() resolves the close promise (no hang)", async () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 50 });
    await ovl.open();
    const closeP = ovl.close();
    ovl.destroy();
    await Promise.race([
      closeP,
      new Promise((_, rej) => setTimeout(() => rej(new Error("close hung")), 500)),
    ]);
  });

  it("rapid open→close→open does not bleed stale transitionend events", async () => {
    const { panel, backdrop } = makeDom();
    const ovl = new OverlayEngine({ element: panel, backdrop, duration: 50 });
    await ovl.open();
    const closeP = ovl.close();
    const openP = ovl.open();
    await Promise.all([closeP, openP]);
    expect(ovl.state.isOpen).toBe(true);
    expect(panel.getAttribute("data-state")).toBe("open");
    panel.dispatchEvent(
      new TransitionEvent("transitionend", { propertyName: "transform" }),
    );
    expect(panel.getAttribute("data-state")).toBe("open");
    ovl.destroy();
  });

  it("open() after destroy() returns a resolved promise without side effects", async () => {
    const { panel } = makeDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0 });
    ovl.destroy();
    const onOpen = vi.fn();
    ovl.on("open", onOpen);
    await ovl.open();
    expect(onOpen).not.toHaveBeenCalled();
    expect(ovl.state.isOpen).toBe(false);
  });

  it("open() reverts to closed state when installInteractiveListeners throws", async () => {
    const queueMicroSpy = vi
      .spyOn(globalThis, "queueMicrotask")
      .mockImplementation(() => {});
    const { panel, backdrop } = makeDom();
    const ovl = new OverlayEngine({
      element: panel,
      backdrop,
      duration: 0,
      focusTrap: true,
    });
    panel.querySelectorAll = (() => {
      throw new Error("synthetic install failure");
    }) as typeof panel.querySelectorAll;
    await ovl.open();
    expect(ovl.state.isOpen).toBe(false);
    expect(panel.getAttribute("data-state")).toBe("closed");
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(panel.style.transform).toContain("translate3d(0, 100%, 0)");
    expect(queueMicroSpy).toHaveBeenCalled();
    ovl.destroy();
    queueMicroSpy.mockRestore();
  });

  it("inertSiblings:true bails cleanly when overlay is not a body descendant", async () => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    const sibling = document.createElement("div");
    sibling.id = "unrelated-sibling";
    document.body.appendChild(sibling);
    const panel = document.createElement("section");
    const ovl = new OverlayEngine({
      element: panel,
      duration: 0,
      inertSiblings: true,
    });
    await ovl.open();
    expect(sibling.hasAttribute("inert")).toBe(false);
    ovl.destroy();
  });

  describe("close reason payload", () => {
    it("emits reason='programmatic' for bare close()", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      await ovl.open();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      await ovl.close();
      expect(onClose).toHaveBeenCalledWith({ reason: "programmatic" });
      ovl.destroy();
    });

    it("emits reason='escape' when Escape key triggers close", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0, focusTrap: false });
      await ovl.open();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await new Promise(r => setTimeout(r, 100));
      expect(onClose).toHaveBeenCalledWith({ reason: "escape" });
      ovl.destroy();
    });

    it("emits reason='backdrop' when backdrop click triggers close", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
      await ovl.open();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      expect(onClose).toHaveBeenCalledWith({ reason: "backdrop" });
      ovl.destroy();
    });

    it("emits reason='swipe' when swipe gesture dismisses", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        swipeToClose: true,
      });
      Object.defineProperty(panel, "offsetHeight", { value: 200, configurable: true });
      await ovl.open();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      panel.dispatchEvent(new PointerEvent("pointerdown", { clientY: 0, button: 0 } as PointerEventInit));
      panel.dispatchEvent(new PointerEvent("pointermove", { clientY: 100 } as PointerEventInit));
      panel.dispatchEvent(new PointerEvent("pointerup", { clientY: 100 } as PointerEventInit));
      await new Promise(r => setTimeout(r, 100));
      expect(onClose).toHaveBeenCalledWith({ reason: "swipe" });
      ovl.destroy();
    });

    it("emits reason='back' when popstate triggers close", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0, closeOnBack: true });
      await ovl.open();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      window.dispatchEvent(new PopStateEvent("popstate"));
      await new Promise(r => setTimeout(r, 100));
      expect(onClose).toHaveBeenCalledWith({ reason: "back" });
      ovl.destroy();
    });
  });

  describe("mountTo option", () => {
    it("'body' moves element to document.body on open and restores on destroy", async () => {
      while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
      const host = document.createElement("div");
      host.id = "host";
      const panel = document.createElement("section");
      host.appendChild(panel);
      document.body.appendChild(host);
      const ovl = new OverlayEngine({ element: panel, duration: 0, mountTo: "body" });
      expect(panel.parentNode).toBe(host);
      await ovl.open();
      expect(panel.parentNode).toBe(document.body);
      ovl.destroy();
      expect(panel.parentNode).toBe(host);
    });

    it("'parent' (default) does not move the element", async () => {
      while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
      const host = document.createElement("div");
      const panel = document.createElement("section");
      host.appendChild(panel);
      document.body.appendChild(host);
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      await ovl.open();
      expect(panel.parentNode).toBe(host);
      ovl.destroy();
      expect(panel.parentNode).toBe(host);
    });
  });

  describe("swipeToClose config object", () => {
    it("respects custom threshold and velocityThreshold", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        swipeToClose: { threshold: 0.5, velocityThreshold: 1.0 },
      });
      Object.defineProperty(panel, "offsetHeight", { value: 200, configurable: true });
      await ovl.open();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      panel.dispatchEvent(new PointerEvent("pointerdown", { clientY: 0, button: 0 } as PointerEventInit));
      await new Promise(r => setTimeout(r, 100));
      panel.dispatchEvent(new PointerEvent("pointermove", { clientY: 60 } as PointerEventInit));
      panel.dispatchEvent(new PointerEvent("pointerup", { clientY: 60 } as PointerEventInit));
      await new Promise(r => setTimeout(r, 30));
      expect(onClose).not.toHaveBeenCalled();
      ovl.destroy();
    });
  });

  describe("peek option", () => {
    it("peek:60 keeps 60px visible when closed (inline transform)", () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0, peek: 60 });
      expect(panel.style.transform).toContain("calc(100% - 60px)");
      expect(panel.hasAttribute("hidden")).toBe(false);
      expect(panel.style.opacity).toBe("1");
      ovl.destroy();
    });

    it("peek on non-bottom edge warns and falls back to fully-closed", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        edge: "top",
        duration: 0,
        peek: 60,
      });
      expect(warnSpy).toHaveBeenCalled();
      expect(panel.style.transform).toContain("translate3d(0, -100%, 0)");
      ovl.destroy();
      warnSpy.mockRestore();
    });

    it("peek persists after close (does not hide panel)", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0, peek: 80 });
      await ovl.open();
      await ovl.close();
      expect(panel.hasAttribute("hidden")).toBe(false);
      expect(panel.style.transform).toContain("calc(100% - 80px)");
      ovl.destroy();
    });
  });

  describe("closeOnOutsidePointer", () => {
    it("closes when pointerdown lands on document.body", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        closeOnOutsidePointer: true,
        focusTrap: false,
      });
      await ovl.open();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true } as PointerEventInit));
      await new Promise(r => setTimeout(r, 100));
      expect(onClose).toHaveBeenCalledWith({ reason: "outside-pointer" });
      ovl.destroy();
    });

    it("does NOT close when pointerdown lands on the overlay itself", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        closeOnOutsidePointer: true,
        focusTrap: false,
      });
      await ovl.open();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      panel.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true } as PointerEventInit));
      await new Promise(r => setTimeout(r, 30));
      expect(onClose).not.toHaveBeenCalled();
      ovl.destroy();
    });

    it("listener is removed after close (no leak)", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        closeOnOutsidePointer: true,
        focusTrap: false,
      });
      await ovl.open();
      await ovl.close();
      const onClose = vi.fn();
      ovl.on("close", onClose);
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true } as PointerEventInit));
      await new Promise(r => setTimeout(r, 30));
      expect(onClose).not.toHaveBeenCalled();
      ovl.destroy();
    });
  });

  describe("aria-modal autoToggle", () => {
    it("sets aria-modal='true' on open and removes on close when focusTrap=true", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0, focusTrap: true });
      expect(panel.hasAttribute("aria-modal")).toBe(false);
      await ovl.open();
      expect(panel.getAttribute("aria-modal")).toBe("true");
      await ovl.close();
      expect(panel.hasAttribute("aria-modal")).toBe(false);
      ovl.destroy();
    });

    it("never sets aria-modal when focusTrap=false", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0, focusTrap: false });
      await ovl.open();
      expect(panel.hasAttribute("aria-modal")).toBe(false);
      await ovl.close();
      expect(panel.hasAttribute("aria-modal")).toBe(false);
      ovl.destroy();
    });
  });

  describe("OverlayEngine runtime setters", () => {
    it("setBackdropOpacity(0.3) writes immediately when open", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
      await ovl.open();
      ovl.setBackdropOpacity(0.3);
      expect(backdrop.style.opacity).toBe("0.3");
      ovl.destroy();
    });

    it("setBackdropOpacity(0.3) defers to next open() when closed", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
      ovl.setBackdropOpacity(0.3);
      expect(backdrop.style.opacity).toBe("0");
      await ovl.open();
      expect(backdrop.style.opacity).toBe("0.3");
      ovl.destroy();
    });

    it("setBackdropFilter('blur(20px)') applies when open, defers when closed", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
      ovl.setBackdropFilter("blur(20px)");
      expect(backdrop.style.backdropFilter ?? "").toBe("");
      await ovl.open();
      expect(backdrop.style.backdropFilter).toBe("blur(20px)");
      ovl.setBackdropFilter("blur(4px)");
      expect(backdrop.style.backdropFilter).toBe("blur(4px)");
      ovl.destroy();
    });

    it("setBackdropFilter(undefined) clears the live filter", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        backdrop,
        duration: 0,
        backdropFilter: "blur(8px)",
      });
      await ovl.open();
      expect(backdrop.style.backdropFilter).toBe("blur(8px)");
      ovl.setBackdropFilter(undefined);
      expect(backdrop.style.backdropFilter).toBe("");
      ovl.destroy();
    });

    it("setSwipeToClose({threshold: 0.5}) — values respected on next swipe", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        swipeToClose: true,
      });
      Object.defineProperty(panel, "offsetHeight", { value: 200, configurable: true });
      await ovl.open();
      ovl.setSwipeToClose({ threshold: 0.5 });
      const onClose = vi.fn();
      ovl.on("close", onClose);
      panel.dispatchEvent(new PointerEvent("pointerdown", { clientY: 0, button: 0 } as PointerEventInit));
      await new Promise(r => setTimeout(r, 100));
      panel.dispatchEvent(new PointerEvent("pointermove", { clientY: 60 } as PointerEventInit));
      panel.dispatchEvent(new PointerEvent("pointerup", { clientY: 60 } as PointerEventInit));
      await new Promise(r => setTimeout(r, 30));
      expect(onClose).not.toHaveBeenCalled();
      ovl.destroy();
    });

    it("setSwipeToClose(false) tears down the swipe listener", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        swipeToClose: true,
      });
      Object.defineProperty(panel, "offsetHeight", { value: 200, configurable: true });
      await ovl.open();
      ovl.setSwipeToClose(false);
      const onClose = vi.fn();
      ovl.on("close", onClose);
      panel.dispatchEvent(new PointerEvent("pointerdown", { clientY: 0, button: 0 } as PointerEventInit));
      panel.dispatchEvent(new PointerEvent("pointermove", { clientY: 180 } as PointerEventInit));
      panel.dispatchEvent(new PointerEvent("pointerup", { clientY: 180 } as PointerEventInit));
      await new Promise(r => setTimeout(r, 30));
      expect(onClose).not.toHaveBeenCalled();
      ovl.destroy();
    });

    it("setSwipeToClose(true) installs swipe listener when previously disabled and currently open", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        swipeToClose: false,
      });
      Object.defineProperty(panel, "offsetHeight", { value: 200, configurable: true });
      await ovl.open();
      ovl.setSwipeToClose(true);
      const onClose = vi.fn();
      ovl.on("close", onClose);
      panel.dispatchEvent(new PointerEvent("pointerdown", { clientY: 0, button: 0 } as PointerEventInit));
      panel.dispatchEvent(new PointerEvent("pointermove", { clientY: 100 } as PointerEventInit));
      panel.dispatchEvent(new PointerEvent("pointerup", { clientY: 100 } as PointerEventInit));
      await new Promise(r => setTimeout(r, 100));
      expect(onClose).toHaveBeenCalledWith({ reason: "swipe" });
      ovl.destroy();
    });

    it("setEnterAnimation('fade') only takes effect on next open", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      await ovl.open();
      const transformBefore = panel.style.transform;
      ovl.setEnterAnimation("fade");
      expect(panel.style.transform).toBe(transformBefore);
      await ovl.close();
      await ovl.open();
      expect(panel.style.transform).toContain("translate3d(0, 0, 0)");
      ovl.destroy();
    });

    it("setOverlay({preset: 'dialog'}) applies all preset values", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
      await ovl.open();
      ovl.setOverlay({ preset: "dialog" });
      expect(backdrop.style.opacity).toBe("0.6");
      expect(backdrop.style.backdropFilter).toBe("blur(8px)");
      ovl.destroy();
    });

    it("setOverlay({preset: 'dialog', backdropOpacity: 0.9}) — preset, then override", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
      await ovl.open();
      ovl.setOverlay({ preset: "dialog", backdropOpacity: 0.9 });
      expect(backdrop.style.opacity).toBe("0.9");
      expect(backdrop.style.backdropFilter).toBe("blur(8px)");
      ovl.destroy();
    });

    it("all setters no-op safely after destroy", () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
      ovl.destroy();
      const backdropBefore = backdrop.style.cssText;
      const panelHtmlBefore = panel.innerHTML;
      expect(() => ovl.setBackdropOpacity(0.5)).not.toThrow();
      expect(() => ovl.setBackdropFilter("blur(4px)")).not.toThrow();
      expect(() => ovl.setSwipeToClose(true)).not.toThrow();
      expect(() => ovl.setEnterAnimation("fade")).not.toThrow();
      expect(() => ovl.setExitAnimation("scale")).not.toThrow();
      expect(() => ovl.setReturnFocus(undefined)).not.toThrow();
      expect(() => ovl.setOverlay({ preset: "dialog" })).not.toThrow();
      expect(() => ovl.setOverlayChildren(document.createElement("div"))).not.toThrow();
      expect(() => ovl.setOverlayChildren(() => document.createElement("div"))).not.toThrow();
      expect(() => ovl.clearOverlayChildren()).not.toThrow();
      expect(() => ovl.setOverlay({ children: document.createElement("div") })).not.toThrow();
      expect(() => ovl.setOverlay({ children: null })).not.toThrow();
      expect(backdrop.style.cssText).toBe(backdropBefore);
      expect(panel.innerHTML).toBe(panelHtmlBefore);
      expect(ovl.state.isOpen).toBe(false);
    });

    it("constructor preset:'toast' applies preset, explicit options override", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        backdrop,
        duration: 0,
        preset: "toast",
        backdropOpacity: 0.2,
      });
      await ovl.open();
      expect(backdrop.style.opacity).toBe("0.2");
      expect(panel.style.transform).toContain("translate3d(0, 0, 0)");
      ovl.destroy();
    });
  });

  describe("OverlayEngine runtime children injection", () => {
    it("setOverlayChildren(div) replaces element contents with the div", () => {
      const { panel } = makeDom();
      panel.appendChild(document.createElement("p"));
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      const div = document.createElement("div");
      div.id = "injected";
      ovl.setOverlayChildren(div);
      expect(panel.children.length).toBe(1);
      expect(panel.firstElementChild).toBe(div);
      ovl.destroy();
    });

    it("setOverlayChildren(() => div) calls function once, appends result", () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      const div = document.createElement("div");
      ovl.setOverlayChildren(() => div);
      expect(panel.firstElementChild).toBe(div);
      ovl.destroy();
    });

    it("setOverlayChildren called twice replaces (no accumulation)", () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      const first = document.createElement("article");
      const second = document.createElement("section");
      ovl.setOverlayChildren(first);
      ovl.setOverlayChildren(second);
      expect(panel.children.length).toBe(1);
      expect(panel.firstElementChild).toBe(second);
      ovl.destroy();
    });

    it("clearOverlayChildren() removes all children, resets hasInjectedChildren", () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      ovl.setOverlayChildren(document.createElement("div"));
      expect(panel.children.length).toBe(1);
      ovl.clearOverlayChildren();
      expect(panel.children.length).toBe(0);
      panel.appendChild(document.createElement("p"));
      ovl.clearOverlayChildren();
      expect(panel.children.length).toBe(1);
      ovl.destroy();
    });

    it("clearOverlayChildren() is no-op when nothing was injected", () => {
      const { panel } = makeDom();
      const native = document.createElement("p");
      panel.appendChild(native);
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      ovl.clearOverlayChildren();
      expect(panel.children.length).toBe(1);
      expect(panel.firstElementChild).toBe(native);
      ovl.destroy();
    });

    it("setOverlay({ children: div }) batch — applied after preset/style changes", async () => {
      const { panel, backdrop } = makeDom();
      const ovl = new OverlayEngine({ element: panel, backdrop, duration: 0 });
      await ovl.open();
      const div = document.createElement("div");
      div.id = "batched";
      ovl.setOverlay({ preset: "dialog", backdropOpacity: 0.7, children: div });
      expect(backdrop.style.opacity).toBe("0.7");
      expect(panel.firstElementChild).toBe(div);
      ovl.destroy();
    });

    it("setOverlay({ children: null }) clears", () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({ element: panel, duration: 0 });
      ovl.setOverlayChildren(document.createElement("div"));
      expect(panel.children.length).toBe(1);
      ovl.setOverlay({ children: null });
      expect(panel.children.length).toBe(0);
      ovl.destroy();
    });

  });

  describe("returnFocus single-fire invariant", () => {
    it("returnFocus fires exactly once per open cycle, not again on destroy", async () => {
      const { panel } = makeDom();
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      const focusSpy = vi.spyOn(trigger, "focus");

      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        returnFocus: trigger,
      });
      await ovl.open();
      await ovl.close();
      expect(focusSpy).toHaveBeenCalledTimes(1);

      ovl.destroy();
      expect(focusSpy).toHaveBeenCalledTimes(1);

      focusSpy.mockRestore();
    });

    it("destroy of an open overlay still releases scroll-lock + fires returnFocus once", async () => {
      const { panel } = makeDom();
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      const focusSpy = vi.spyOn(trigger, "focus");

      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
        returnFocus: trigger,
        lockBodyScroll: true,
      });
      await ovl.open();
      expect(document.body.style.overflow).toBe("hidden");

      ovl.destroy();
      expect(focusSpy).toHaveBeenCalledTimes(1);
      expect(document.body.style.overflow).not.toBe("hidden");

      focusSpy.mockRestore();
    });

    it("setReturnFocus after destroy is a no-op", async () => {
      const { panel } = makeDom();
      const ovl = new OverlayEngine({
        element: panel,
        duration: 0,
      });
      ovl.destroy();
      const stale = document.createElement("button");
      const staleSpy = vi.spyOn(stale, "focus");
      expect(() => ovl.setReturnFocus(stale)).not.toThrow();
      expect(staleSpy).not.toHaveBeenCalled();
      staleSpy.mockRestore();
    });
  });
});
