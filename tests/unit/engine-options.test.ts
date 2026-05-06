import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_DRAG_THRESHOLD,
  DEFAULT_FLICK_VELOCITY,
  resolveEngineOptions,
} from "../../src/core/primitives/engine-options";

const baseElement = (): HTMLElement => document.createElement("div");

describe("resolveEngineOptions — defaults", () => {
  it("fills every `??` default when caller passes only the required surface", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
    });
    expect(r.mode).toBe("bottom");
    expect(r.flickVelocity).toBe(DEFAULT_FLICK_VELOCITY);
    expect(r.dragThreshold).toBe(DEFAULT_DRAG_THRESHOLD);
    expect(r.rubberBandEnabled).toBe(true);
    expect(r.closeOnBack).toBe(false);
  });

  it("preserves explicit values over defaults", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
      mode: "top",
      flickVelocity: 1.5,
      dragThreshold: 32,
      rubberBand: false,
      closeOnBack: true,
    });
    expect(r.mode).toBe("top");
    expect(r.flickVelocity).toBe(1.5);
    expect(r.dragThreshold).toBe(32);
    expect(r.rubberBandEnabled).toBe(false);
    expect(r.closeOnBack).toBe(true);
  });
});

describe("resolveEngineOptions — initial id chain", () => {
  it("uses opts.initial when set", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "full",
    });
    expect(r.initialId).toBe("full");
    expect(r.initialAllowed).toEqual(["min", "full"]);
  });

  it("falls back to allowed[0] when initial omitted", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      allowed: ["full", "min"],
    });
    expect(r.initialId).toBe("full");
    expect(r.initialAllowed).toEqual(["full", "min"]);
  });

  it("falls back to snapPoints[0].id when initial AND allowed both omitted", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [
        { id: "first", size: 100 },
        { id: "second", size: 800 },
      ],
    });
    expect(r.initialId).toBe("first");
    expect(r.initialAllowed).toEqual(["first", "second"]);
  });

  it("degenerates to 'default' when snapPoints is empty", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [],
    });
    expect(r.initialId).toBe("default");
    expect(r.initialAllowed).toEqual([]);
  });
});

describe("resolveEngineOptions — persist override", () => {
  // happy-dom's localStorage stub is unreliable across versions — the
  // engine-features suite uses the same fake-storage pattern for its persist
  // tests. Mirror that here so the persist branch is actually exercised.
  let store: Record<string, string>;
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    store = {};
    original = Object.getOwnPropertyDescriptor(window, "localStorage") ?? undefined;
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
        key: () => null,
        get length() {
          return Object.keys(store).length;
        },
      },
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    if (original) {
      Object.defineProperty(window, "localStorage", original);
    } else {
      delete (window as { localStorage?: Storage }).localStorage;
    }
  });

  it("uses persisted id when valid (in allowed list)", () => {
    window.localStorage.setItem("test-key", "full");
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      persistKey: "test-key",
    });
    expect(r.initialId).toBe("full");
  });

  it("ignores persisted id when not in allowed list", () => {
    window.localStorage.setItem("test-key", "ghost-id");
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      persistKey: "test-key",
    });
    expect(r.initialId).toBe("min");
  });

  it("does not read localStorage when persistKey omitted", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const el = baseElement();
    resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
    });
    expect(getItem).not.toHaveBeenCalled();
    getItem.mockRestore();
  });
});

describe("resolveEngineOptions — scrim auto-promotion", () => {
  it("auto-promotes scrimInteractive=true when scrimTapToClose is set and interactive omitted", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
      scrimTapToClose: true,
    });
    expect(r.scrim.scrimInteractive).toBe(true);
    expect(r.scrim.scrimTapToClose).toBe(true);
  });

  it("respects explicit scrimInteractive=false even when scrimTapToClose is on", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
      scrimTapToClose: true,
      scrimInteractive: false,
    });
    expect(r.scrim.scrimInteractive).toBe(false);
  });

  it("leaves scrimInteractive undefined when neither tap-to-close nor interactive set", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
    });
    expect(r.scrim.scrimInteractive).toBeUndefined();
  });
});

describe("resolveEngineOptions — pass-through option bags", () => {
  it("forwards animation options as-is (engine wires AnimationRunner from this bag)", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
      animation: "spring",
      duration: 350,
      spring: { stiffness: 200, damping: 25 },
      respectReducedMotion: false,
      viewTransitions: true,
    });
    expect(r.animation.animation).toBe("spring");
    expect(r.animation.duration).toBe(350);
    expect(r.animation.spring).toEqual({ stiffness: 200, damping: 25 });
    expect(r.animation.respectReducedMotion).toBe(false);
    expect(r.animation.viewTransitions).toBe(true);
  });

  it("forwards lifecycle options as-is when no extras passed (shouldApplyInertSiblings stays undefined)", () => {
    const el = baseElement();
    const r = resolveEngineOptions({
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
      focusTrap: true,
      initialFocus: "[autofocus]",
      closeOnEscape: false,
      lockBodyScroll: false,
      inertSiblings: true,
    });
    expect(r.lifecycle.focusTrap).toBe(true);
    expect(r.lifecycle.initialFocus).toBe("[autofocus]");
    expect(r.lifecycle.closeOnEscape).toBe(false);
    expect(r.lifecycle.lockBodyScroll).toBe(false);
    expect(r.lifecycle.inertSiblings).toBe(true);
    // No extras → controller uses its own default predicate.
    expect(r.lifecycle.shouldApplyInertSiblings).toBeUndefined();
  });
});

describe("resolveEngineOptions — extras pass-through", () => {
  it("folds extras.shouldApplyInertSiblings into resolved.lifecycle so the bag is fully assembled", () => {
    const el = baseElement();
    const predicate = (): boolean => true;
    const r = resolveEngineOptions(
      {
        element: el,
        handle: el,
        snapPoints: [{ id: "a", size: 100 }],
      },
      { shouldApplyInertSiblings: predicate },
    );
    // Identity preserved — same closure reference, no wrapping. Engine's
    // body-descendant check stays cheap (no extra call indirection).
    expect(r.lifecycle.shouldApplyInertSiblings).toBe(predicate);
  });

  it("leaves resolved.lifecycle.shouldApplyInertSiblings undefined when extras lacks it", () => {
    const el = baseElement();
    const r = resolveEngineOptions(
      {
        element: el,
        handle: el,
        snapPoints: [{ id: "a", size: 100 }],
      },
      {},
    );
    expect(r.lifecycle.shouldApplyInertSiblings).toBeUndefined();
  });
});

describe("resolveEngineOptions — purity", () => {
  it("does not mutate the input opts object", () => {
    const el = baseElement();
    const opts = {
      element: el,
      handle: el,
      snapPoints: [{ id: "a", size: 100 }],
    };
    const snapshot = JSON.parse(
      JSON.stringify({ ...opts, snapPoints: opts.snapPoints }),
    );
    resolveEngineOptions(opts);
    // element/handle have circular refs from DOM so compare the JSON-safe slice.
    expect(JSON.parse(JSON.stringify({ snapPoints: opts.snapPoints }))).toEqual(
      { snapPoints: snapshot.snapPoints },
    );
  });
});
