import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { attachDebugOverlay } from "../../src/debug";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

const settle = () => new Promise(r => setTimeout(r, 30));

const makeSheet = () => {
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

const mkEngine = () => {
  const n = makeSheet();
  return new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: 300 },
      { id: "full", size: 600 },
    ],
    initial: "closed",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
  });
};

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
});

describe("debug overlay", () => {
  it("mounts a panel with resolved snaps and updates on snap", async () => {
    const engine = mkEngine();
    const detach = attachDebugOverlay(engine);
    const panel = document.querySelector("[data-bs-debug]") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain("active  closed");
    expect(panel.textContent).toContain("half: 300px");
    expect(panel.textContent).toContain("full: 600px");

    await engine.snapTo("half");
    await settle();
    expect(panel.textContent).toContain("active  half");
    expect(panel.textContent).toContain("size    300.0px");

    detach();
    engine.destroy();
  });

  it("throttles progress updates through rAF", async () => {
    const engine = mkEngine();
    const raf: { cb: FrameRequestCallback | null } = { cb: null };
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(cb => {
        raf.cb = cb;
        return 1;
      });
    const detach = attachDebugOverlay(engine);
    const panel = document.querySelector("[data-bs-debug]") as HTMLElement;

    const emit = (
      engine as unknown as {
        emit: (e: string, p: unknown) => void;
      }
    ).emit?.bind(engine);
    if (emit) {
      emit("progress", { value: 0.5, size: 150 });
      emit("progress", { value: 0.6, size: 180 });
      expect(rafSpy.mock.calls.length).toBe(1);
      raf.cb?.(0);
    } else {
      await engine.snapTo("half");
      raf.cb?.(0);
    }
    expect(panel).not.toBeNull();

    rafSpy.mockRestore();
    detach();
    engine.destroy();
  });

  it("detach removes the panel and stops updates", async () => {
    const engine = mkEngine();
    const detach = attachDebugOverlay(engine);
    detach();
    expect(document.querySelector("[data-bs-debug]")).toBeNull();

    await engine.snapTo("half");
    await settle();
    expect(document.querySelector("[data-bs-debug]")).toBeNull();
    detach();
    engine.destroy();
  });

  it("stacks a second panel for a second engine", () => {
    const e1 = mkEngine();
    const e2 = mkEngine();
    const d1 = attachDebugOverlay(e1);
    const d2 = attachDebugOverlay(e2);
    const panels = document.querySelectorAll("[data-bs-debug]");
    expect(panels.length).toBe(2);
    const top1 = (panels[0] as HTMLElement).style.top;
    const top2 = (panels[1] as HTMLElement).style.top;
    expect(top1).not.toBe(top2);
    d1();
    d2();
    e1.destroy();
    e2.destroy();
  });

  it("honors position option", () => {
    const engine = mkEngine();
    const detach = attachDebugOverlay(engine, { position: "bottom-left" });
    const panel = document.querySelector("[data-bs-debug]") as HTMLElement;
    expect(panel.style.bottom).not.toBe("");
    expect(panel.style.left).not.toBe("");
    expect(panel.style.top).toBe("");
    detach();
    engine.destroy();
  });
});
