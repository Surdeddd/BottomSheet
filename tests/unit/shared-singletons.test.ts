import { describe, expect, it, beforeEach, vi } from "vitest";

const freshCopy = async <T>(load: () => Promise<T>): Promise<T> => {
  vi.resetModules();
  return load();
};

const settle = () => new Promise(r => setTimeout(r, 120));

describe("module state shared across bundle copies", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("style");
  });

  it("hands two copies of the stack module the same stack", async () => {
    const a = await freshCopy(() => import("../../src/core/lifecycle/sheet-stack"));
    const b = await freshCopy(() => import("../../src/core/lifecycle/sheet-stack"));
    expect(a).not.toBe(b);
    expect(a.sheetStack).toBe(b.sheetStack);
  });

  it("counts body scroll locks across two copies of the lock module", async () => {
    const a = await freshCopy(() => import("../../src/core/lifecycle/scroll-lock"));
    const b = await freshCopy(() => import("../../src/core/lifecycle/scroll-lock"));
    a.__resetScrollLockForTests();
    const releaseA = a.lockBodyScroll();
    const releaseB = b.lockBodyScroll();
    releaseA();
    expect(document.body.style.position).toBe("fixed");
    releaseB();
    expect(document.body.style.position).toBe("");
  });

  it("never repeats an instance id between two copies", async () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    try {
      const a = await freshCopy(() => import("../../src/core/primitives/instance-id"));
      const b = await freshCopy(() => import("../../src/core/primitives/instance-id"));
      const ids = [a.nextInstanceId("bs"), b.nextInstanceId("bs"), a.nextInstanceId("bs")];
      expect(new Set(ids).size).toBe(3);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: original,
        configurable: true,
      });
    }
  });

  it("stacks a sheet from one copy above an overlay from another and frees the page afterwards", async () => {
    const sheetModule = await freshCopy(() => import("../../src/core/BottomSheetEngine"));
    const overlayModule = await freshCopy(() => import("../../src/core/overlay"));
    const lock = await import("../../src/core/lifecycle/scroll-lock");
    const stack = await import("../../src/core/lifecycle/sheet-stack");
    lock.__resetScrollLockForTests();
    stack.__resetSheetStackForTests();

    const panel = document.createElement("section");
    document.body.appendChild(panel);
    const overlay = new overlayModule.OverlayEngine({
      element: panel,
      duration: 0,
      focusTrap: false,
    });
    const sheetEl = document.createElement("section");
    const handle = document.createElement("div");
    sheetEl.appendChild(handle);
    document.body.appendChild(sheetEl);
    const sheet = new sheetModule.BottomSheetEngine({
      element: sheetEl,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    await overlay.open();
    await sheet.open("full");
    await settle();
    expect(Number(sheetEl.style.zIndex)).toBeGreaterThan(Number(panel.style.zIndex));
    expect(document.body.style.position).toBe("fixed");

    await sheet.close();
    await settle();
    expect(overlay.state.isOpen).toBe(true);
    expect(document.body.style.position).toBe("fixed");

    await overlay.close();
    await settle();
    expect(document.body.style.position).toBe("");

    sheet.destroy();
    overlay.destroy();
  });
});
