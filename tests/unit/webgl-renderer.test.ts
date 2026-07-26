import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { webglRenderer } from "../../src/webgl";
import type { WebGLUnsupportedReason } from "../../src/webgl";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

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
    duration: 10,
    ...extra,
  };
};

describe("webglRenderer — degradation", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("removes itself when the environment has no WebGL", async () => {
    const reasons: WebGLUnsupportedReason[] = [];
    const opts = baseOpts({
      features: [webglRenderer({ onUnsupported: r => reasons.push(r) })],
    });
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    expect(reasons).toContain("no-webgl");
    expect(document.querySelector("canvas")).toBeNull();
    engine.destroy();
  });

  it("leaves the DOM sheet paintable when it bails", async () => {
    const opts = baseOpts({ features: [webglRenderer()] });
    const el = opts.element as HTMLElement;
    el.style.background = "rgb(20, 20, 20)";
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    expect(el.style.background).toBe("rgb(20, 20, 20)");
    expect(el.hasAttribute("data-bs-webgl")).toBe(false);
    engine.destroy();
  });

  it("bails under prefers-reduced-motion before touching WebGL", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes("prefers-reduced-motion"),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    const reasons: WebGLUnsupportedReason[] = [];
    const opts = baseOpts({
      features: [webglRenderer({ onUnsupported: r => reasons.push(r) })],
    });
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    expect(reasons).toEqual(["reduced-motion"]);
    engine.destroy();
    window.matchMedia = original;
  });

  it("does not throw when the engine is destroyed right after install", async () => {
    const opts = baseOpts({ features: [webglRenderer()] });
    const engine = new BottomSheetEngine(opts as never);
    expect(() => engine.destroy()).not.toThrow();
    await settle();
  });

  it("keeps the sheet operable after bailing", async () => {
    const opts = baseOpts({ features: [webglRenderer()] });
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    await engine.snapTo("full");
    await settle();
    expect(engine.state.activeId).toBe("full");

    await engine.snapTo("closed");
    await settle();
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });

  it("adds no canvas and no attribute to the page when unsupported", async () => {
    const opts = baseOpts({ features: [webglRenderer()] });
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    expect(document.querySelectorAll("canvas").length).toBe(0);
    expect(document.querySelectorAll("[data-bs-webgl]").length).toBe(0);
    engine.destroy();
  });
});
