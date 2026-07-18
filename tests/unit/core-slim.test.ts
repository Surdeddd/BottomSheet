import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { MockInstance } from "vitest";
import { BottomSheetCore } from "../../src/core-slim";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import {
  routeFeature,
  persistFeature,
  autoCollapseFeature,
} from "../../src/core/features-entry";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { __resetHistoryCoordinatorForTests } from "../../src/core/features/history-coordinator";

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

const baseOpts = (extra: Record<string, unknown> = {}) => {
  const n = makeSheet();
  return {
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "full", size: 400 },
    ],
    initial: "closed" as const,
    animation: "tween" as const,
    duration: 0,
    respectReducedMotion: false,
    ...extra,
  };
};

let pushSpy: MockInstance;
let store: Record<string, string>;
let originalLocalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  __resetHistoryCoordinatorForTests();
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
  store = {};
  originalLocalStorage =
    Object.getOwnPropertyDescriptor(window, "localStorage") ?? undefined;
  Object.defineProperty(window, "localStorage", {
    value: {
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
    },
    configurable: true,
    writable: true,
  });
  pushSpy = vi.spyOn(history, "pushState");
  vi.spyOn(history, "back").mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
});

afterEach(() => {
  __resetHistoryCoordinatorForTests();
  vi.restoreAllMocks();
  if (originalLocalStorage) {
    Object.defineProperty(window, "localStorage", originalLocalStorage);
  } else {
    delete (window as unknown as Record<string, unknown>).localStorage;
  }
});

const markerPushed = () =>
  pushSpy.mock.calls.some(c => (c[0] as Record<string, unknown>)?.__bs);

describe("slim core — feature matrix", () => {
  it("closeOnBack without routeFeature pushes no marker and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = new BottomSheetCore(baseOpts({ closeOnBack: true }));
    expect(
      warnSpy.mock.calls.some(c => String(c[0]).includes("routeFeature")),
    ).toBe(true);

    await engine.open("full");
    await settle();
    expect(engine.state.size).toBeGreaterThan(0);
    expect(markerPushed()).toBe(false);

    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    expect(engine.state.size).toBeGreaterThan(0);
    engine.destroy();
  });

  it("closeOnBack with routeFeature() pushes a marker and Back closes", async () => {
    const engine = new BottomSheetCore(
      baseOpts({ closeOnBack: true, features: [routeFeature()] }),
    );
    await engine.open("full");
    await settle();
    expect(markerPushed()).toBe(true);

    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });

  it("persistKey without persistFeature warns and does not write snaps", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = new BottomSheetCore(baseOpts({ persistKey: "slim-k" }));
    expect(
      warnSpy.mock.calls.some(c => String(c[0]).includes("persistFeature")),
    ).toBe(true);
    await engine.snapTo("full");
    await settle();
    expect(store["slim-k"]).toBeUndefined();
    engine.destroy();
  });

  it("persistFeature() writes the snap id", async () => {
    const engine = new BottomSheetCore(
      baseOpts({ persistKey: "slim-k2", features: [persistFeature()] }),
    );
    await engine.snapTo("full");
    await settle();
    expect(store["slim-k2"]).toBe("full");
    engine.destroy();
  });

  it("autoCollapseFeature() collapses after inactivity", async () => {
    vi.useFakeTimers();
    const engine = new BottomSheetCore(
      baseOpts({
        snapPoints: [
          { id: "closed", size: 0 },
          { id: "min", size: 100 },
          { id: "full", size: 400 },
        ],
        initial: "full",
        autoCollapseAfter: 50,
        features: [autoCollapseFeature()],
      }),
    );
    expect(engine.state.activeId).toBe("full");
    await vi.advanceTimersByTimeAsync(80);
    await vi.runAllTimersAsync();
    expect(engine.state.activeId).toBe("min");
    vi.useRealTimers();
    engine.destroy();
  });

  it("slim core without autoCollapseFeature never collapses", async () => {
    vi.useFakeTimers();
    const engine = new BottomSheetCore(
      baseOpts({
        snapPoints: [
          { id: "closed", size: 0 },
          { id: "min", size: 100 },
          { id: "full", size: 400 },
        ],
        initial: "full",
        autoCollapseAfter: 50,
      }),
    );
    await vi.advanceTimersByTimeAsync(200);
    await vi.runAllTimersAsync();
    expect(engine.state.activeId).toBe("full");
    vi.useRealTimers();
    engine.destroy();
  });

  it("duplicate feature names dedupe last-wins", () => {
    const seen: string[] = [];
    const mk = (tag: string) => ({
      name: "probe",
      install: () => {
        seen.push(tag);
      },
    });
    const engine = new BottomSheetCore(
      baseOpts({ features: [mk("first"), mk("second")] }),
    );
    expect(seen).toEqual(["second"]);
    engine.destroy();
  });

  it("full BottomSheetEngine keeps default features (closeOnBack works out of the box)", async () => {
    const engine = new BottomSheetEngine(baseOpts({ closeOnBack: true }));
    await engine.open("full");
    await settle();
    expect(markerPushed()).toBe(true);
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });

  it("full engine installs a user feature exactly once after defaults", () => {
    let installs = 0;
    const engine = new BottomSheetEngine(
      baseOpts({
        features: [
          {
            name: "custom-probe",
            install: () => {
              installs += 1;
            },
          },
        ],
      }),
    );
    expect(installs).toBe(1);
    engine.destroy();
  });
});
