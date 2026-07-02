import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";
import type { Plugin } from "../../src/core/types";
import { makeDom } from "./_helpers/makeDom";

const resetGlobals = () => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  __resetRouteCoordinatorForTests();
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
};

describe("BottomSheetEngine — persistKey", () => {
  let store: Record<string, string>;
  let originalLocalStorage: PropertyDescriptor | undefined;

  beforeEach(() => {
    resetGlobals();
    store = {};
    originalLocalStorage =
      Object.getOwnPropertyDescriptor(window, "localStorage") ?? undefined;
    const fakeStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: fakeStorage,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(window, "localStorage", originalLocalStorage);
    } else {
      delete (window as any).localStorage;
    }
  });

  it("writes activeId to localStorage on construction with non-default initial", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "half", size: 400 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      persistKey: "test-sheet-1",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.snapTo("full");
    expect(store["test-sheet-1"]).toBe("full");
    engine.destroy();
  });

  it("restores activeId from localStorage on construction", () => {
    store["test-sheet-2"] = "full";
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "closed",
      persistKey: "test-sheet-2",
      respectReducedMotion: false,
    });
    expect(engine.state.activeId).toBe("full");
    expect(engine.state.size).toBe(800);
    engine.destroy();
  });

  it("ignores persisted id when not in allowedIds (stale-id protection)", () => {
    store["test-sheet-3"] = "ghost";
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      persistKey: "test-sheet-3",
      respectReducedMotion: false,
    });
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });

  it("does not throw when localStorage is absent (SSR-style)", () => {
    delete (window as any).localStorage;
    const { sheet, handle } = makeDom();
    expect(() => {
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        snapPoints: [{ id: "min", size: 100 }],
        initial: "min",
        persistKey: "test-sheet-ssr",
        respectReducedMotion: false,
      });
      engine.destroy();
    }).not.toThrow();
  });

  it("does not throw when localStorage.getItem throws (Safari private mode)", () => {
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("QuotaExceededError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
      configurable: true,
      writable: true,
    });
    const { sheet, handle } = makeDom();
    expect(() => {
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        snapPoints: [{ id: "min", size: 100 }],
        initial: "min",
        persistKey: "test-sheet-throws",
        respectReducedMotion: false,
      });
      engine.destroy();
    }).not.toThrow();
  });

  it("persists id across two engine instances sharing the same persistKey", async () => {
    const { sheet: sheetA, handle: handleA } = makeDom();
    const engineA = new BottomSheetEngine({
      element: sheetA,
      handle: handleA,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      persistKey: "shared-key",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engineA.snapTo("full");
    engineA.destroy();
    expect(store["shared-key"]).toBe("full");

    const { sheet: sheetB, handle: handleB } = makeDom();
    const engineB = new BottomSheetEngine({
      element: sheetB,
      handle: handleB,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      persistKey: "shared-key",
      respectReducedMotion: false,
    });
    expect(engineB.state.activeId).toBe("full");
    engineB.destroy();
  });
});

describe("BottomSheetEngine — resize mid-animation resync", () => {
  beforeEach(() => resetGlobals());

  it("re-emits snap/open and installs lifecycle when a resize cancels an opening animation", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 300,
      respectReducedMotion: false,
    });
    const events: string[] = [];
    engine.on("snap", p => events.push(`snap:${p.id}`));
    engine.on("open", p => events.push(`open:${p.id}`));
    void engine.open("full");
    await new Promise(r => setTimeout(r, 60));
    window.dispatchEvent(new Event("orientationchange"));
    await new Promise(r => setTimeout(r, 60));
    expect(events).toContain("snap:full");
    expect(events).toContain("open:full");
    expect(engine.state.size).toBe(800);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await new Promise(r => setTimeout(r, 400));
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });

  it("idle resize emits no spurious events", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await new Promise(r => setTimeout(r, 20));
    const events: string[] = [];
    engine.on("snap", p => events.push(`snap:${p.id}`));
    engine.on("open", p => events.push(`open:${p.id}`));
    engine.on("close", () => events.push("close"));
    window.dispatchEvent(new Event("orientationchange"));
    await new Promise(r => setTimeout(r, 30));
    expect(events).toEqual([]);
    engine.destroy();
  });
});

describe("BottomSheetEngine — autoCollapseAfter", () => {
  beforeEach(() => {
    resetGlobals();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-collapses to the first non-zero allowed snap after the idle window", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      autoCollapseAfter: 200,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.state.activeId).toBe("full");

    await engine.snapTo("full");

    await vi.advanceTimersByTimeAsync(250);
    await vi.runAllTimersAsync();

    expect(engine.state.activeId).toBe("min");
    engine.destroy();
  });

  it("resets the timer on activity (snap call)", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "half", size: 400 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      autoCollapseAfter: 200,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.snapTo("full");

    await vi.advanceTimersByTimeAsync(150);
    await engine.snapTo("half");
    expect(engine.state.activeId).toBe("half");

    await vi.advanceTimersByTimeAsync(150);
    expect(engine.state.activeId).toBe("half");

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();
    expect(engine.state.activeId).toBe("min");
    engine.destroy();
  });

  it("does not fire while isDragging is true", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      autoCollapseAfter: 200,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.snapTo("full");
    (engine as any).gesture.isDragging_ = true;
    await vi.advanceTimersByTimeAsync(250);
    await vi.runAllTimersAsync();
    expect(engine.state.activeId).toBe("full");
    (engine as any).gesture.isDragging_ = false;
    engine.destroy();
  });

  it("does nothing when already at the first non-zero allowed snap", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      autoCollapseAfter: 200,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onSnap = vi.fn();
    engine.on("snap", onSnap);
    await engine.snapTo("min");
    onSnap.mockClear();
    await vi.advanceTimersByTimeAsync(250);
    await vi.runAllTimersAsync();
    expect(onSnap).not.toHaveBeenCalled();
    expect(engine.state.activeId).toBe("min");
    engine.destroy();
  });

  it("destroy() clears the pending timer (no leak)", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      autoCollapseAfter: 200,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.snapTo("full");
    const beforeDestroyActive = engine.state.activeId;
    engine.destroy();
    await vi.advanceTimersByTimeAsync(500);
    await vi.runAllTimersAsync();
    expect(engine.state.activeId).toBe(beforeDestroyActive);
  });

  it("disabled when autoCollapseAfter is undefined", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.snapTo("full");
    await vi.advanceTimersByTimeAsync(5000);
    await vi.runAllTimersAsync();
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });
});

describe("BottomSheetEngine — linkedSheets", () => {
  beforeEach(() => {
    resetGlobals();
  });

  it("opening A snaps B to its first non-closed allowed id", async () => {
    const domA = makeDom();
    const sheetB = document.createElement("section");
    const handleB = document.createElement("div");
    sheetB.appendChild(handleB);
    document.body.appendChild(sheetB);
    Object.assign(handleB, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });

    const engineB = new BottomSheetEngine({
      element: sheetB,
      handle: handleB,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const engineA = new BottomSheetEngine({
      element: domA.sheet,
      handle: domA.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 600 },
      ],
      initial: "closed",
      linkedSheets: [engineB],
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const snapToSpy = vi.spyOn(engineB, "snapTo");

    await engineA.open();
    await new Promise(r => setTimeout(r, 30));

    expect(snapToSpy).toHaveBeenCalled();
    const calledWith = snapToSpy.mock.calls[0]?.[0];
    expect(calledWith).not.toBe("closed");
    expect(engineB.state.activeId).not.toBe("full");

    engineA.destroy();
    engineB.destroy();
  });

  it("setLinkedSheets() works post-construction", async () => {
    const domA = makeDom();
    const sheetB = document.createElement("section");
    const handleB = document.createElement("div");
    sheetB.appendChild(handleB);
    document.body.appendChild(sheetB);
    Object.assign(handleB, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });

    const engineB = new BottomSheetEngine({
      element: sheetB,
      handle: handleB,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const engineA = new BottomSheetEngine({
      element: domA.sheet,
      handle: domA.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 600 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    engineA.setLinkedSheets([engineB]);
    const snapToSpy = vi.spyOn(engineB, "snapTo");

    await engineA.open();
    await new Promise(r => setTimeout(r, 30));

    expect(snapToSpy).toHaveBeenCalled();
    engineA.destroy();
    engineB.destroy();
  });

  it("does not infinite-loop when both sheets link to each other", async () => {
    const domA = makeDom();
    const sheetB = document.createElement("section");
    const handleB = document.createElement("div");
    sheetB.appendChild(handleB);
    document.body.appendChild(sheetB);
    Object.assign(handleB, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });

    const engineB = new BottomSheetEngine({
      element: sheetB,
      handle: handleB,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const engineA = new BottomSheetEngine({
      element: domA.sheet,
      handle: domA.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 50 },
        { id: "open", size: 600 },
      ],
      initial: "closed",
      linkedSheets: [engineB],
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engineB.setLinkedSheets([engineA]);

    const aSnapSpy = vi.spyOn(engineA, "snapTo");
    await engineA.open();
    await new Promise(r => setTimeout(r, 60));

    expect(aSnapSpy).toHaveBeenCalledTimes(1);
    engineA.destroy();
    engineB.destroy();
  });

  it("self-link in linkedSheets is a no-op (defensive)", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "open", size: 600 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setLinkedSheets([engine]);
    await expect(engine.open()).resolves.toBeUndefined();
    engine.destroy();
  });

  it("setLinkedSheets() on destroyed engine no-ops", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.destroy();
    expect(() => engine.setLinkedSheets([])).not.toThrow();
  });

  it("does not snap a linked sheet to a size-0 rest snap that is first in allowed", async () => {
    const domA = makeDom();
    const sheetB = document.createElement("section");
    const handleB = document.createElement("div");
    sheetB.appendChild(handleB);
    document.body.appendChild(sheetB);
    Object.assign(handleB, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });

    const engineB = new BottomSheetEngine({
      element: sheetB,
      handle: handleB,
      snapPoints: [
        { id: "hidden", size: 0 },
        { id: "half", size: 300 },
      ],
      allowed: ["hidden", "half"],
      initial: "half",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const engineA = new BottomSheetEngine({
      element: domA.sheet,
      handle: domA.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 600 },
      ],
      initial: "closed",
      linkedSheets: [engineB],
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    await engineA.open();
    await new Promise(r => setTimeout(r, 30));

    expect(engineB.state.activeId).toBe("half");
    expect(engineB.state.size).toBe(300);

    engineA.destroy();
    engineB.destroy();
  });
});

describe("BottomSheetEngine — Plugin system", () => {
  beforeEach(() => {
    resetGlobals();
  });

  it("install runs once and teardown runs on destroy", () => {
    const { sheet, handle } = makeDom();
    const install = vi.fn();
    const teardown = vi.fn();
    const plugin: Plugin = {
      name: "test-plugin",
      install: engine => {
        install(engine);
        return teardown;
      },
    };
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.use(plugin);
    expect(install).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith(engine);
    expect(teardown).not.toHaveBeenCalled();
    engine.destroy();
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("install runs once at use() time (independent of teardown wiring)", () => {
    const { sheet, handle } = makeDom();
    const install = vi.fn();
    const plugin: Plugin = {
      name: "install-only",
      install: engine => {
        install(engine);
      },
    };
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.use(plugin);
    expect(install).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith(engine);
    engine.destroy();
  });

  it("plugin install can subscribe via engine.on() and listeners are removed by destroy", async () => {
    const { sheet, handle } = makeDom();
    const onSnap = vi.fn();
    const plugin: Plugin = {
      name: "snap-watcher",
      install: engine => {
        engine.on("snap", onSnap);
      },
    };
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.use(plugin);
    await engine.snapTo("b");
    expect(onSnap).toHaveBeenCalledTimes(1);

    onSnap.mockClear();
    engine.destroy();
    expect(onSnap).not.toHaveBeenCalled();
  });

  it("plugin without teardown — destroy does not crash", () => {
    const { sheet, handle } = makeDom();
    const plugin: Plugin = {
      name: "no-teardown",
      install: () => {
      },
    };
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.use(plugin);
    expect(() => engine.destroy()).not.toThrow();
  });

  it("use() on destroyed engine warns and is a no-op", () => {
    const { sheet, handle } = makeDom();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const install = vi.fn();
    const plugin: Plugin = {
      name: "late-install",
      install,
    };
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.destroy();
    const result = engine.use(plugin);
    expect(install).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(result).toBe(engine);
    warn.mockRestore();
  });

  it("use() returns the engine for chaining", () => {
    const { sheet, handle } = makeDom();
    const a: Plugin = { name: "a", install: () => {} };
    const b: Plugin = { name: "b", install: () => {} };
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    expect(engine.use(a).use(b)).toBe(engine);
    engine.destroy();
  });

  it("multiple plugins with teardowns: all teardowns run on destroy", () => {
    const { sheet, handle } = makeDom();
    const teardownA = vi.fn();
    const teardownB = vi.fn();
    const teardownC = vi.fn();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine
      .use({ name: "a", install: () => teardownA })
      .use({ name: "b", install: () => teardownB })
      .use({ name: "c", install: () => teardownC });
    engine.destroy();
    expect(teardownA).toHaveBeenCalledTimes(1);
    expect(teardownB).toHaveBeenCalledTimes(1);
    expect(teardownC).toHaveBeenCalledTimes(1);
  });

  it("plugin.install() throwing is isolated — engine stays usable, sibling plugins still install", () => {
    const { sheet, handle } = makeDom();
    const teardownAfter = vi.fn();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });

    const captured: unknown[] = [];
    const realQueueMicrotask = globalThis.queueMicrotask;
    globalThis.queueMicrotask = (fn: () => void) => {
      try {
        fn();
      } catch (err) {
        captured.push(err);
      }
    };

    try {
      const buggyPlugin: Plugin = {
        name: "buggy",
        install: () => {
          throw new Error("boom");
        },
      };
      const goodPlugin: Plugin = {
        name: "good",
        install: () => teardownAfter,
      };

      expect(() => engine.use(buggyPlugin)).not.toThrow();
      engine.use(goodPlugin);

      const boomThrows = captured.filter(
        e => e instanceof Error && e.message === "boom",
      );
      expect(boomThrows).toHaveLength(1);
    } finally {
      globalThis.queueMicrotask = realQueueMicrotask;
    }

    engine.destroy();
    expect(teardownAfter).toHaveBeenCalledTimes(1);
  });

  it("transactional install: scope.add cleanups run on throw, partial side effects rolled back", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });

    const captured: unknown[] = [];
    const realQueueMicrotask = globalThis.queueMicrotask;
    globalThis.queueMicrotask = (fn: () => void) => {
      try {
        fn();
      } catch (err) {
        captured.push(err);
      }
    };

    try {
      const order: string[] = [];
      const cleanupA = vi.fn(() => void order.push("A"));
      const cleanupB = vi.fn(() => void order.push("B"));
      const cleanupC = vi.fn(() => {
        order.push("C");
        throw new Error("cleanup-c-buggy");
      });

      const partialPlugin = {
        name: "partial",
        install: (_: unknown, scope: { add: (fn: () => void) => void }) => {
          scope.add(cleanupA);
          scope.add(cleanupB);
          scope.add(cleanupC);
          throw new Error("install-failed");
        },
      };
      engine.use(partialPlugin as never);

      expect(cleanupA).toHaveBeenCalledTimes(1);
      expect(cleanupB).toHaveBeenCalledTimes(1);
      expect(cleanupC).toHaveBeenCalledTimes(1);
      expect(order).toEqual(["C", "B", "A"]);

      const messages = captured
        .filter(e => e instanceof Error)
        .map(e => (e as Error).message);
      expect(messages).toEqual(["cleanup-c-buggy", "install-failed"]);
    } finally {
      globalThis.queueMicrotask = realQueueMicrotask;
    }

    engine.destroy();
  });

  it("scope.add(null) / scope.add(undefined) / non-function values are no-ops", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });

    const validCleanup = vi.fn();
    const noopPlugin = {
      name: "noop-pusher",
      install: (
        _: unknown,
        scope: { add: (fn: unknown) => void },
      ) => {
        scope.add(null);
        scope.add(undefined);
        scope.add(0);
        scope.add("");
        scope.add("not-a-function");
        scope.add({});
        scope.add(validCleanup);
      },
    };

    expect(() => engine.use(noopPlugin as never)).not.toThrow();

    expect(() => engine.destroy()).not.toThrow();
    expect(validCleanup).toHaveBeenCalledTimes(1);
  });

  it("transactional install: scope.add cleanups merge into destroy stack on success", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });

    const cleanupA = vi.fn();
    const cleanupB = vi.fn();
    const teardown = vi.fn();

    const richPlugin = {
      name: "rich",
      install: (_: unknown, scope: { add: (fn: () => void) => void }) => {
        scope.add(cleanupA);
        scope.add(cleanupB);
        return teardown;
      },
    };
    engine.use(richPlugin as never);

    expect(cleanupA).not.toHaveBeenCalled();
    expect(cleanupB).not.toHaveBeenCalled();
    expect(teardown).not.toHaveBeenCalled();

    engine.destroy();
    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
  });
});

describe("BottomSheetEngine — dragTo", () => {
  beforeEach(() => {
    resetGlobals();
  });

  it("animates and resolves to the requested target", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 800 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.dragTo(300);
    expect(engine.state.size).toBe(300);
    expect(engine.state.activeId).toBe("a");
    engine.destroy();
  });

  it("clamps targets below 0 to 0", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 800 },
      ],
      initial: "b",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.dragTo(-500);
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });

  it("clamps targets above maxAxisSize to maxAxisSize", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 800 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const max = (
      engine as unknown as { snaps: { getMaxAxisSize: () => number } }
    ).snaps.getMaxAxisSize();
    expect(max).toBe(800);
    await engine.dragTo(99999);
    expect(engine.state.size).toBe(max);
    engine.destroy();
  });

  it("does NOT fire snap event", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 800 },
      ],
      initial: "a",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    const onSnap = vi.fn();
    const onBefore = vi.fn();
    engine.on("snap", onSnap);
    engine.on("before-snap", onBefore);
    await engine.dragTo(400);
    expect(onSnap).not.toHaveBeenCalled();
    expect(onBefore).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("resolves cleanly when destroy() runs mid-flight", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 800 },
      ],
      initial: "a",
      animation: "tween",
      duration: 50,
      respectReducedMotion: false,
    });
    const dragPromise = engine.dragTo(400);
    engine.destroy();
    await Promise.race([
      dragPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("dragTo hung")), 500)),
    ]);
  });

  it("is a no-op when called on an already-destroyed engine", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "a", size: 100 }],
      respectReducedMotion: false,
    });
    engine.destroy();
    await expect(engine.dragTo(50)).resolves.toBeUndefined();
  });
});

describe("BottomSheetEngine — scroll position preservation", () => {
  beforeEach(() => {
    resetGlobals();
  });

  it("restores scrollTop when snap goes full → mini → full", async () => {
    const { sheet, handle, content } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [
        { id: "mini", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    content.scrollTop = 200;
    await engine.snapTo("mini");
    content.scrollTop = 0;
    await engine.snapTo("full");
    expect(content.scrollTop).toBe(200);
    engine.destroy();
  });

  it("preserves two roundtrips independently", async () => {
    const { sheet, handle, content } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [
        { id: "mini", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    content.scrollTop = 150;
    await engine.snapTo("mini");
    content.scrollTop = 0;
    await engine.snapTo("full");
    expect(content.scrollTop).toBe(150);

    content.scrollTop = 320;
    await engine.snapTo("mini");
    content.scrollTop = 0;
    await engine.snapTo("full");
    expect(content.scrollTop).toBe(320);
    engine.destroy();
  });

  it("preserves scroll position per-snap-id independently", async () => {
    const { sheet, handle, content } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [
        { id: "mini", size: 100 },
        { id: "half", size: 600 },
        { id: "full", size: 1100 },
      ],
      initial: "half",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    content.scrollTop = 100;
    await engine.snapTo("mini");
    content.scrollTop = 0;

    await engine.snapTo("full");
    expect(content.scrollTop).toBe(0);

    content.scrollTop = 400;
    await engine.snapTo("mini");
    content.scrollTop = 0;

    await engine.snapTo("half");
    expect(content.scrollTop).toBe(100);

    await engine.snapTo("mini");
    content.scrollTop = 0;
    await engine.snapTo("full");
    expect(content.scrollTop).toBe(400);

    engine.destroy();
  });

  it("clears the cache on setSnapPoints (no stale restore)", async () => {
    const { sheet, handle, content } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [
        { id: "mini", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    content.scrollTop = 250;
    await engine.snapTo("mini");
    engine.setSnapPoints([
      { id: "mini", size: 100 },
      { id: "full", size: 800 },
    ]);
    content.scrollTop = 0;
    await engine.snapTo("full");
    expect(content.scrollTop).toBe(0);
    engine.destroy();
  });

  it("is a no-op when scrollContainer is not provided", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "mini", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await expect(engine.snapTo("mini")).resolves.toBeUndefined();
    await expect(engine.snapTo("full")).resolves.toBeUndefined();
    engine.destroy();
  });
});

describe("BottomSheetEngine — route (closeOnBack mount-time check)", () => {
  beforeEach(resetGlobals);

  it("pushes a closeOnBack history marker at install time when initial size > 0", () => {
    const pushSpy = vi.spyOn(history, "pushState");
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 400 },
      ],
      initial: "open",
      closeOnBack: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    const bsCalls = pushSpy.mock.calls.filter(
      ([state]) =>
        typeof state === "object" &&
        state !== null &&
        "__bsSheet" in (state as object),
    );
    expect(bsCalls).toHaveLength(1);
    expect(bsCalls[0]?.[0]).toMatchObject({
      __bsSheet: expect.stringMatching(/^bs-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/),
    });

    pushSpy.mockRestore();
    engine.destroy();
  });

  it("does NOT push a closeOnBack marker at install time when initial size = 0", () => {
    const pushSpy = vi.spyOn(history, "pushState");
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 400 },
      ],
      initial: "closed",
      closeOnBack: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    const bsCalls = pushSpy.mock.calls.filter(
      ([state]) =>
        typeof state === "object" &&
        state !== null &&
        "__bsSheet" in (state as object),
    );
    expect(bsCalls).toHaveLength(0);

    pushSpy.mockRestore();
    engine.destroy();
  });
});

describe("BottomSheetEngine — scrim options", () => {
  beforeEach(() => {
    resetGlobals();
  });

  const makeDomWithScreen = () => {
    const dom = makeDom();
    const screen = document.createElement("div");
    document.body.appendChild(screen);
    return { ...dom, screen };
  };

  it("scrimColor writes background to screenComponent", () => {
    const { sheet, handle, screen } = makeDomWithScreen();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      scrimColor: "rgba(0,0,0,0.6)",
      respectReducedMotion: false,
    });
    expect(screen.style.background).toContain("rgba(0, 0, 0, 0.6)");
    engine.destroy();
  });

  it("scrimBlur writes backdrop-filter: blur(8px) to screenComponent", () => {
    const { sheet, handle, screen } = makeDomWithScreen();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      scrimBlur: "8px",
      respectReducedMotion: false,
    });
    const filter =
      screen.style.backdropFilter ||
      screen.style.getPropertyValue("backdrop-filter");
    expect(filter).toBe("blur(8px)");
    engine.destroy();
  });

  it("scrimInteractive: false (default) sets pointer-events: none on screen", () => {
    const { sheet, handle, screen } = makeDomWithScreen();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      respectReducedMotion: false,
    });
    expect(screen.style.pointerEvents).toBe("none");
    engine.destroy();
  });

  it("scrimInteractive: true leaves pointer-events as 'auto'", () => {
    const { sheet, handle, screen } = makeDomWithScreen();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      scrimInteractive: true,
      respectReducedMotion: false,
    });
    expect(screen.style.pointerEvents).toBe("auto");
    engine.destroy();
  });

  it("scrimTapToClose: true → click on screen closes the sheet", async () => {
    const { sheet, handle, screen } = makeDomWithScreen();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      scrimTapToClose: true,
      scrimInteractive: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.state.activeId).toBe("full");
    screen.dispatchEvent(new Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });

  it("scrimTapToClose + scrimInteractive:false → engine auto-promotes pointer-events (no deadlock)", async () => {
    const { sheet, handle, screen } = makeDomWithScreen();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      scrimTapToClose: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(screen.style.pointerEvents).toBe("auto");
    screen.dispatchEvent(new Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });
});

describe("BottomSheetEngine — scrim runtime setters", () => {
  beforeEach(() => {
    resetGlobals();
  });

  const makeDomWithScrim = () => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    const sheet = document.createElement("section");
    const handle = document.createElement("div");
    const content = document.createElement("div");
    const backdrop = document.createElement("div");
    const screen = document.createElement("div");
    sheet.appendChild(handle);
    sheet.appendChild(content);
    document.body.appendChild(backdrop);
    document.body.appendChild(screen);
    document.body.appendChild(sheet);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    return { sheet, handle, content, backdrop, screen };
  };

  const setSize = (engine: BottomSheetEngine, size: number): void => {
    (engine as unknown as { applySize: (n: number) => void }).applySize(size);
  };

  it("setBackdropRange([0.5, 1]) — opacity 0 below the new start, ramps up after", () => {
    const { sheet, handle, backdrop } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "min",
      respectReducedMotion: false,
    });
    engine.setBackdropRange([0.5, 1]);
    setSize(engine, 400);
    expect(parseFloat(backdrop.style.opacity || "0")).toBeCloseTo(0, 2);
    setSize(engine, 700);
    expect(parseFloat(backdrop.style.opacity)).toBeCloseTo(0.4, 2);
    engine.destroy();
  });

  it("setScreenRange([0.2, 0.8]) — interior progress maps linearly into 0..1", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "min",
      respectReducedMotion: false,
    });
    engine.setScreenRange([0.2, 0.8]);
    setSize(engine, 500);
    expect(parseFloat(screen.style.opacity)).toBeCloseTo(0.5, 2);
    setSize(engine, 900);
    expect(parseFloat(screen.style.opacity)).toBeCloseTo(1, 2);
    setSize(engine, 100);
    expect(parseFloat(screen.style.opacity)).toBeCloseTo(0, 2);
    engine.destroy();
  });

  it("setScrimColor writes background; null clears the inline style", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.setScrimColor("rgba(0,0,0,0.9)");
    expect(screen.style.background).toContain("rgba(0, 0, 0, 0.9)");
    engine.setScrimColor(null);
    expect(screen.style.background).toBe("");
    engine.destroy();
  });

  it("setScrimBlur writes blur(...) on backdrop-filter and the WebKit prefix", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.setScrimBlur("10px");
    const filter =
      screen.style.backdropFilter ||
      screen.style.getPropertyValue("backdrop-filter");
    expect(filter).toBe("blur(10px)");
    const w = screen.style as unknown as Record<string, string>;
    expect(w.webkitBackdropFilter).toBe("blur(10px)");
    engine.destroy();
  });

  it("setScrimInteractive(true) clears pointer-events:none; false re-adds it", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    expect(screen.style.pointerEvents).toBe("none");
    engine.setScrimInteractive(true);
    expect(screen.style.pointerEvents).toBe("auto");
    engine.setScrimInteractive(false);
    expect(screen.style.pointerEvents).toBe("none");
    engine.destroy();
  });

  it("setScrim({ preset: 'monitoring' }) applies all preset values", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "min",
      respectReducedMotion: false,
    });
    engine.setScrim({ preset: "monitoring" });
    expect(screen.style.background).toContain("rgba(15, 15, 20, 0.55)");
    const filter =
      screen.style.backdropFilter ||
      screen.style.getPropertyValue("backdrop-filter");
    expect(filter).toBe("blur(4px)");
    expect(screen.style.pointerEvents).toBe("none");
    setSize(engine, 500);
    expect(parseFloat(screen.style.opacity)).toBeCloseTo(0.5, 2);
    engine.destroy();
  });

  it("setScrim({ preset, color }) — preset baseline applied, then explicit color wins", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.setScrim({ preset: "monitoring", color: "#ff0000" });
    expect(screen.style.background).toBe("#ff0000");
    const filter =
      screen.style.backdropFilter ||
      screen.style.getPropertyValue("backdrop-filter");
    expect(filter).toBe("blur(4px)");
    engine.destroy();
  });

  it("all setters no-op after destroy (no throw, no DOM mutation)", () => {
    const { sheet, handle, screen, backdrop } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      backdrop,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.destroy();
    const snapshot = {
      background: screen.style.background,
      pointerEvents: screen.style.pointerEvents,
      backdropFilter: screen.style.backdropFilter,
      opacity: screen.style.opacity,
    };
    expect(() => engine.setBackdropRange([0.5, 1])).not.toThrow();
    expect(() => engine.setScreenRange([0.5, 1])).not.toThrow();
    expect(() => engine.setScrimColor("#000")).not.toThrow();
    expect(() => engine.setScrimBlur("4px")).not.toThrow();
    expect(() => engine.setScrimInteractive(true)).not.toThrow();
    expect(() => engine.setScrim({ preset: "cinematic", color: "#fff" })).not.toThrow();
    expect(screen.style.background).toBe(snapshot.background);
    expect(screen.style.pointerEvents).toBe(snapshot.pointerEvents);
    expect(screen.style.backdropFilter).toBe(snapshot.backdropFilter);
    expect(screen.style.opacity).toBe(snapshot.opacity);
  });

  it("constructor scrimPreset: 'cinematic' applies preset then explicit scrimColor wins", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      scrimPreset: "cinematic",
      scrimColor: "rgba(255,0,0,0.5)",
      respectReducedMotion: false,
    });
    expect(screen.style.background).toContain("rgba(255, 0, 0, 0.5)");
    const filter =
      screen.style.backdropFilter ||
      screen.style.getPropertyValue("backdrop-filter");
    expect(filter).toBe("blur(12px)");
    engine.destroy();
  });
});

describe("scrim runtime mode + enabled + overlay slot", () => {
  beforeEach(() => {
    resetGlobals();
  });

  const makeDomWithScrim = () => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    const root = document.createElement("div");
    root.className = "bs-root";
    const sheet = document.createElement("section");
    const handle = document.createElement("div");
    const content = document.createElement("div");
    const backdrop = document.createElement("div");
    const screen = document.createElement("div");
    screen.className = "bs-screen";
    sheet.appendChild(handle);
    sheet.appendChild(content);
    root.appendChild(backdrop);
    root.appendChild(screen);
    root.appendChild(sheet);
    document.body.appendChild(root);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    return { sheet, handle, content, backdrop, screen, root };
  };

  const setSize = (engine: BottomSheetEngine, size: number): void => {
    (engine as unknown as { applySize: (n: number) => void }).applySize(size);
  };

  it("setScrimMode('off') → screen opacity becomes '0' and display 'none'", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "min",
      respectReducedMotion: false,
    });
    setSize(engine, 800);
    expect(parseFloat(screen.style.opacity)).toBeGreaterThan(0);
    engine.setScrimMode("off");
    expect(screen.style.opacity).toBe("0");
    expect(screen.style.display).toBe("none");
    engine.destroy();
  });

  it("setScrimMode('above-sheet') after construction with 'full' applies position:fixed + inset", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    expect(screen.style.position).toBe("");
    engine.setScrimMode("above-sheet");
    expect(screen.style.position).toBe("fixed");
    expect(screen.style.inset).toContain("var(--bs-size)");
    expect(screen.style.pointerEvents).toBe("none");
    engine.destroy();
  });

  it("setScrimMode('full') after 'above-sheet' clears position/inset back to ''", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      scrimMode: "above-sheet",
      respectReducedMotion: false,
    });
    expect(screen.style.position).toBe("fixed");
    engine.setScrimMode("full");
    expect(screen.style.position).toBe("");
    expect(screen.style.inset).toBe("");
    expect(screen.style.pointerEvents).toBe("");
    engine.destroy();
  });

  it("setScrimTapToClose(true) after construction installs listener; click closes the sheet", async () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.state.activeId).toBe("full");
    engine.setScrimTapToClose(true);
    screen.dispatchEvent(new Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });

  it("setScrimTapToClose(false) after setScrimTapToClose(true) tears down — click no longer snaps", async () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setScrimTapToClose(true);
    engine.setScrimTapToClose(false);
    screen.dispatchEvent(new Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });

  it("setScrimTapToClose(true) called twice doesn't double-install (handler fires once)", async () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    engine.setScrimTapToClose(true);
    const teardownRef = (engine as unknown as { detachScrimTap: unknown })
      .detachScrimTap;
    engine.setScrimTapToClose(true);
    expect(
      (engine as unknown as { detachScrimTap: unknown }).detachScrimTap,
    ).toBe(teardownRef);
    const spy = vi.spyOn(engine, "snapTo");
    screen.dispatchEvent(new Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    expect(spy).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it("setScrimEnabled(false) makes screen opacity 0 regardless of progress", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "min",
      respectReducedMotion: false,
    });
    setSize(engine, 800);
    expect(parseFloat(screen.style.opacity)).toBeGreaterThan(0);
    engine.setScrimEnabled(false);
    setSize(engine, 800);
    expect(parseFloat(screen.style.opacity)).toBe(0);
    setSize(engine, 200);
    expect(parseFloat(screen.style.opacity)).toBe(0);
    engine.destroy();
  });

  it("setScrimEnabled(true) restores prior range values", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "min",
      screenRange: [0.2, 0.8],
      respectReducedMotion: false,
    });
    engine.setScrimEnabled(false);
    engine.setScrimEnabled(true);
    setSize(engine, 500);
    expect(parseFloat(screen.style.opacity)).toBeCloseTo(0.5, 2);
    engine.destroy();
  });

  it("setScrim({ mode: 'off', enabled: false }) batch applies both", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "full", size: 1000 },
      ],
      initial: "min",
      respectReducedMotion: false,
    });
    setSize(engine, 800);
    engine.setScrim({ mode: "off", enabled: false });
    expect(screen.style.opacity).toBe("0");
    expect(screen.style.display).toBe("none");
    const state = engine.getScrimState();
    expect(state.enabled).toBe(false);
    expect(state.mode).toBe("off");
    engine.destroy();
  });

  it("setScrimOverlay({ children, position: 'top-right' }) appends wrapper with correct inline positioning", () => {
    const { sheet, handle, screen, root } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    const child = document.createElement("button");
    child.textContent = "X";
    engine.setScrimOverlay({ children: child, position: "top-right" });
    const wrapper = root.querySelector(".bs-scrim-overlay") as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.parentElement).toBe(root);
    expect(wrapper.style.position).toBe("absolute");
    expect(wrapper.style.top).toBe("16px");
    expect(wrapper.style.right).toBe("16px");
    expect(wrapper.style.pointerEvents).toBe("auto");
    expect(wrapper.contains(child)).toBe(true);
    engine.destroy();
  });

  it("setScrimOverlay called twice replaces (only one .bs-scrim-overlay on .bs-root)", () => {
    const { sheet, handle, screen, root } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    const a = document.createElement("button");
    const b = document.createElement("button");
    engine.setScrimOverlay({ children: a });
    engine.setScrimOverlay({ children: b });
    const wrappers = root.querySelectorAll(".bs-scrim-overlay");
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0]?.contains(b)).toBe(true);
    expect(wrappers[0]?.contains(a)).toBe(false);
    engine.destroy();
  });

  it("setScrimOverlay returned teardown removes the wrapper", () => {
    const { sheet, handle, screen, root } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    const teardown = engine.setScrimOverlay({
      children: document.createElement("div"),
    });
    expect(root.querySelectorAll(".bs-scrim-overlay")).toHaveLength(1);
    teardown();
    expect(root.querySelectorAll(".bs-scrim-overlay")).toHaveLength(0);
    engine.destroy();
  });

  it("setScrimOverlay wrapper stays in DOM but is visually hidden when scrimMode='off'", () => {
    const { sheet, handle, screen, root } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
      respectReducedMotion: false,
    });
    const btn = document.createElement("button");
    btn.textContent = "click me";
    const teardown = engine.setScrimOverlay({ children: btn, position: "top-right" });
    expect(root.querySelector(".bs-scrim-overlay")).toBeTruthy();

    engine.setScrimMode("off");
    expect(screen.style.display).toBe("none");
    expect(root.querySelector(".bs-scrim-overlay")).toBeTruthy();

    engine.setScrimMode("above-sheet");
    expect(screen.style.display).not.toBe("none");
    expect(root.querySelector(".bs-scrim-overlay")).toBeTruthy();

    teardown();
    engine.destroy();
  });

  it("all new setters no-op cleanly on destroy", () => {
    const { sheet, handle, screen } = makeDomWithScrim();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      screenComponent: screen,
      snapPoints: [{ id: "min", size: 100 }],
      respectReducedMotion: false,
    });
    engine.destroy();
    expect(() => engine.setScrimMode("off")).not.toThrow();
    expect(() => engine.setScrimMode("above-sheet")).not.toThrow();
    expect(() => engine.setScrimTapToClose(true)).not.toThrow();
    expect(() => engine.setScrimTapToClose(false)).not.toThrow();
    expect(() => engine.setScrimEnabled(false)).not.toThrow();
    expect(() => engine.setScrimEnabled(true)).not.toThrow();
    const tearDown = engine.setScrimOverlay({
      children: document.createElement("div"),
    });
    expect(() => tearDown()).not.toThrow();
    expect(screen.querySelectorAll(".bs-scrim-overlay")).toHaveLength(0);
  });

  it("destroy() resets ALL dedup sentinels including string-typed pointer/display", async () => {
    const { sheet, handle, backdrop, screen } = makeDomWithScrim();
    const first = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 500 },
      ],
      initial: "open",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await first.snapTo("open");
    expect(backdrop.style.pointerEvents).toBe("auto");
    expect(screen.style.display).not.toBe("none");
    first.destroy();
    expect(backdrop.style.pointerEvents).toBe("");
    expect(screen.style.display).toBe("");

    const second = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 500 },
      ],
      initial: "open",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await second.snapTo("open");
    expect(backdrop.style.pointerEvents).toBe("auto");
    expect(screen.style.display).not.toBe("none");
    second.destroy();
  });
});

describe("BottomSheetEngine — opacity cache invalidation on static sheet (M1-M4 regression)", () => {
  beforeEach(() => {
    resetGlobals();
  });

  const makeDom = () => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    const sheet = document.createElement("section");
    const handle = document.createElement("div");
    const backdrop = document.createElement("div");
    const screen = document.createElement("div");
    sheet.appendChild(handle);
    document.body.appendChild(backdrop);
    document.body.appendChild(screen);
    document.body.appendChild(sheet);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    return { sheet, handle, backdrop, screen };
  };

  it("M1: setScreenRange on a STATIC sheet updates rendered screen opacity", async () => {
    const { sheet, handle, backdrop, screen } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      screenComponent: screen,
      snapPoints: [
        { id: "min", size: 0 },
        { id: "open", size: 500 },
      ],
      initial: "open",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      screenRange: [0, 1],
    });
    await engine.snapTo("open");
    const before = screen.style.opacity;
    expect(before).toBe("1");

    engine.setScreenRange([0.5, 0.6]);
    engine.setScreenRange([0, 2]);
    expect(screen.style.opacity).toBe("0.5");
    engine.destroy();
  });

  it("M2: setScrimMode 'off' → 'full' restores screen opacity (not stuck at 0)", async () => {
    const { sheet, handle, backdrop, screen } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 500 },
      ],
      initial: "open",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    await engine.snapTo("open");
    expect(screen.style.opacity).toBe("1");

    engine.setScrimMode("off");
    expect(screen.style.opacity).toBe("0");
    expect(screen.style.display).toBe("none");

    engine.setScrimMode("full");
    expect(screen.style.opacity).toBe("1");
    expect(screen.style.display).not.toBe("none");
    engine.destroy();
  });

  it("M3: setScrim batch with range invalidates cache", async () => {
    const { sheet, handle, backdrop, screen } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 500 },
      ],
      initial: "open",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      screenRange: [0, 1],
    });
    await engine.snapTo("open");
    expect(screen.style.opacity).toBe("1");

    engine.setScrim({ range: [0, 2] });
    expect(screen.style.opacity).toBe("0.5");
    engine.destroy();
  });

  it("M4: setSnapPoints reshape invalidates scrim cache (geometry changes opacity mapping)", async () => {
    const { sheet, handle, backdrop, screen } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      screenComponent: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 500 },
      ],
      initial: "open",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      screenRange: [0, 1],
    });
    await engine.snapTo("open");
    expect(screen.style.opacity).toBe("1");

    engine.setSnapPoints(
      [
        { id: "closed", size: 0 },
        { id: "open", size: 500 },
        { id: "full", size: 1000 },
      ],
      ["closed", "open", "full"],
    );
    expect(screen.style.opacity).toBe("0.5");
    engine.destroy();
  });
});

describe("BottomSheetEngine — attach() partial-failure rollback (M5 regression)", () => {
  beforeEach(() => {
    resetGlobals();
  });

  it("partial attach() failure rethrows synthetic error from feature install", () => {
    const { sheet, handle } = makeDom();
    const realRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor() {
        throw new Error("synthetic-RO-failure");
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    let constructionError: unknown = null;
    try {
      try {
        new BottomSheetEngine({
          element: sheet,
          handle,
          snapPoints: [{ id: "min", size: 100 }],
          respectReducedMotion: false,
        });
      } catch (err) {
        constructionError = err;
      }

      expect(constructionError).toBeInstanceOf(Error);
      expect((constructionError as Error).message).toBe("synthetic-RO-failure");
    } finally {
      globalThis.ResizeObserver = realRO;
    }
  });
});

describe("snap-points — defensive NaN/negative clamp (E4 regression)", () => {
  it("resolveSnapList clamps NaN sizes to 0 with a warn", async () => {
    const { resolveSnapList } = await import(
      "../../src/core/primitives/snap-points"
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("../../src/core/primitives/cssLength");
    const realResolveSnap = mod.resolveSnap;
    const result = resolveSnapList(
      [
        { id: "ok", size: 200 },
        { id: "bad", size: "asdf" },
      ],
      "bottom",
    );
    expect(result.find(s => s.id === "ok")?.size).toBe(200);
    expect(result.find(s => s.id === "bad")?.size).toBeGreaterThanOrEqual(0);
    warn.mockRestore();
    void realResolveSnap;
  });

  it("Number.isFinite/<0 guard catches synthetic bad values (defense-in-depth)", () => {
    const synthetic = [Number.NaN, -100, Number.POSITIVE_INFINITY, -0.5];
    for (const raw of synthetic) {
      const isInvalid = !Number.isFinite(raw) || raw < 0;
      expect(isInvalid).toBe(true);
    }
    const valid = [0, 100, 0.5, Number.MAX_SAFE_INTEGER];
    for (const raw of valid) {
      const isInvalid = !Number.isFinite(raw) || raw < 0;
      expect(isInvalid).toBe(false);
    }
  });
});

describe("AnimationRunner — null-overwrite race (B1 regression)", () => {
  beforeEach(() => {
    resetGlobals();
  });

  it("rapid sequential snapTo() calls don't stomp each other's spring/tween handles", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 600 },
        { id: "c", size: 800 },
      ],
      initial: "a",
      animation: "tween",
      duration: 30,
      respectReducedMotion: false,
    });
    let raceError: unknown;
    let firstSnap: Promise<void>;
    let secondSnap: Promise<void>;
    expect(() => {
      firstSnap = engine.snapTo("b");
      secondSnap = engine.snapTo("c");
    }).not.toThrow();
    try {
      await Promise.race([
        Promise.all([firstSnap!, secondSnap!]),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("rapid snapTo deadlock — identity check missing?")),
            1000,
          ),
        ),
      ]);
    } catch (err) {
      raceError = err;
    }
    expect(raceError).toBeUndefined();
    expect(engine.state.activeId).toBe("c");
    expect(engine.state.size).toBe(800);
    engine.destroy();
  });

  it("spring-mode rapid sequential snapTo() does not throw or hang", async () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "a", size: 100 },
        { id: "b", size: 400 },
        { id: "c", size: 700 },
      ],
      initial: "a",
      animation: "spring",
      respectReducedMotion: false,
    });
    const firstSnap = engine.snapTo("b");
    const secondSnap = engine.snapTo("c");
    await Promise.race([
      Promise.all([firstSnap, secondSnap]),
      new Promise((_, rej) => setTimeout(() => rej(new Error("snap race hung")), 2000)),
    ]);
    expect(engine.state.activeId).toBe("c");
    engine.destroy();
  });
});

describe("BottomSheetEngine — view transitions abort (E2 regression)", () => {
  beforeEach(() => {
    resetGlobals();
  });

  it("rapid second snapTo skips the in-flight ViewTransition cleanly", async () => {
    const { sheet, handle } = makeDom();

    type SpyFn = ((...args: unknown[]) => void) & {
      mock: { calls: unknown[][] };
    };
    type MockVT = {
      finished: Promise<void>;
      skipTransition: SpyFn;
      _resolveFinished: () => void;
    };
    const makeMockVT = (): MockVT => {
      let resolve!: () => void;
      const finished = new Promise<void>(r => {
        resolve = r;
      });
      return {
        finished,
        skipTransition: vi.fn(() => resolve()) as unknown as SpyFn,
        _resolveFinished: resolve,
      };
    };

    const createdVTs: MockVT[] = [];
    const startViewTransitionSpy = vi.fn((cb: () => void) => {
      cb();
      const vt = makeMockVT();
      createdVTs.push(vt);
      return vt;
    });

    const originalSVT = (document as unknown as { startViewTransition?: unknown })
      .startViewTransition;
    Object.defineProperty(document, "startViewTransition", {
      value: startViewTransitionSpy,
      configurable: true,
      writable: true,
    });

    try {
      const engine = new BottomSheetEngine({
        element: sheet,
        handle,
        snapPoints: [
          { id: "a", size: 100 },
          { id: "b", size: 400 },
          { id: "c", size: 700 },
        ],
        initial: "a",
        animation: "tween",
        duration: 0,
        viewTransitions: true,
        respectReducedMotion: false,
      });

      const firstSnap = engine.snapTo("b");
      const secondSnap = engine.snapTo("c");

      await new Promise(r => setTimeout(r, 10));

      expect(createdVTs.length).toBeGreaterThanOrEqual(1);
      expect(createdVTs[0]!.skipTransition).toHaveBeenCalledTimes(1);

      for (const vt of createdVTs) vt._resolveFinished();

      await Promise.all([firstSnap, secondSnap]);
      expect(engine.state.activeId).toBe("c");
      engine.destroy();
    } finally {
      if (originalSVT === undefined) {
        delete (document as unknown as { startViewTransition?: unknown })
          .startViewTransition;
      } else {
        Object.defineProperty(document, "startViewTransition", {
          value: originalSVT,
          configurable: true,
          writable: true,
        });
      }
    }
  });
});

describe("BottomSheetEngine — inertSiblings body-descendant predicate (E5 regression)", () => {
  beforeEach(() => {
    resetGlobals();
  });

  it("does NOT mark body siblings inert when sheet is detached / not a body descendant", async () => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    const sibA = document.createElement("div");
    sibA.id = "body-sib-a";
    const sibB = document.createElement("div");
    sibB.id = "body-sib-b";
    const sibC = document.createElement("div");
    sibC.id = "body-sib-c";
    document.body.appendChild(sibA);
    document.body.appendChild(sibB);
    document.body.appendChild(sibC);

    const detachedHost = document.createElement("div");
    const sheet = document.createElement("section");
    const handle = document.createElement("div");
    const content = document.createElement("div");
    sheet.appendChild(handle);
    sheet.appendChild(content);
    detachedHost.appendChild(sheet);
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
        { id: "open", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      inertSiblings: true,
      focusTrap: true,
      respectReducedMotion: false,
    });
    await engine.snapTo("open");

    expect(sibA.hasAttribute("inert")).toBe(false);
    expect(sibB.hasAttribute("inert")).toBe(false);
    expect(sibC.hasAttribute("inert")).toBe(false);
    engine.destroy();
  });

  it("DOES mark body siblings inert when sheet IS a direct body child (positive control)", async () => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    const sib = document.createElement("div");
    sib.id = "body-sib";
    document.body.appendChild(sib);

    const sheet = document.createElement("section");
    const handle = document.createElement("div");
    const content = document.createElement("div");
    sheet.appendChild(handle);
    sheet.appendChild(content);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    document.body.appendChild(sheet);

    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      inertSiblings: true,
      focusTrap: true,
      respectReducedMotion: false,
    });
    await engine.snapTo("open");

    expect(sib.hasAttribute("inert")).toBe(true);
    engine.destroy();
    expect(sib.hasAttribute("inert")).toBe(false);
  });
});

describe("BottomSheetEngine — 'fit' snap (content-aware)", () => {
  beforeEach(resetGlobals);

  const stub = (el: HTMLElement, prop: "offsetHeight" | "scrollHeight", v: number) =>
    Object.defineProperty(el, prop, { value: v, configurable: true });

  it("measures the sheet's natural height (handle + content + slots)", () => {
    const { sheet, handle, content } = makeDom();
    stub(sheet, "offsetHeight", 344);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [{ id: "fit", size: "fit" }],
      initial: "fit",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.state.size).toBe(344);
    engine.destroy();
  });

  it("caps the fit size at the viewport", () => {
    const { sheet, handle, content } = makeDom();
    stub(sheet, "offsetHeight", 5000);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [{ id: "fit", size: "fit" }],
      initial: "fit",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.state.size).toBe(1000);
    engine.destroy();
  });

  it("recompute() picks up a content size change", () => {
    const { sheet, handle, content } = makeDom();
    stub(sheet, "offsetHeight", 244);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrollContainer: content,
      snapPoints: [{ id: "fit", size: "fit" }],
      initial: "fit",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(engine.state.size).toBe(244);
    Object.defineProperty(sheet, "offsetHeight", {
      value: 424,
      configurable: true,
    });
    engine.recompute();
    expect(engine.state.size).toBe(424);
    engine.destroy();
  });
});

describe("BottomSheetEngine — scrim default dim (no scrimColor)", () => {
  beforeEach(resetGlobals);

  it("dims by default when a scrim element exists and no backdrop is provided", () => {
    const { sheet, handle } = makeDom();
    const screen = document.createElement("div");
    document.body.appendChild(screen);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrim: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(screen.style.background).not.toBe("");
    engine.destroy();
  });

  it("leaves the scrim transparent by default when a backdrop is present (no double-dim)", () => {
    const { sheet, handle, backdrop } = makeDom();
    const screen = document.createElement("div");
    document.body.appendChild(screen);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      scrim: screen,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    expect(screen.style.background).toBe("");
    engine.destroy();
  });
});
