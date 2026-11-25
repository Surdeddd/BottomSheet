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

type FakeRenderer = { plain?: string; unmasked?: string | null };

const SWIFTSHADER =
  "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)";
const APPLE = "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)";
const MASKED = "WebKit WebGL";
const RENDERER = 0x1f01;
const UNMASKED = 0x9246;

const fakeWebGL = (renderer: FakeRenderer) => {
  const calls = { draws: 0, extensions: [] as string[], losses: 0, lost: false };
  const target: Record<string, unknown> = {
    RENDERER,
    getExtension(name: string) {
      calls.extensions.push(name);
      if (name === "WEBGL_debug_renderer_info") {
        return renderer.unmasked == null
          ? null
          : { UNMASKED_RENDERER_WEBGL: UNMASKED };
      }
      if (name === "WEBGL_lose_context") {
        return {
          loseContext: () => {
            calls.losses += 1;
          },
        };
      }
      return null;
    },
    isContextLost: () => calls.lost,
    getParameter(id: number) {
      if (id === UNMASKED) return renderer.unmasked;
      if (id === RENDERER) return renderer.plain ?? MASKED;
      return 0;
    },
    getShaderPrecisionFormat: () => ({ precision: 23 }),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    drawArrays: () => {
      calls.draws += 1;
    },
  };
  const gl = new Proxy(target, {
    get(source, key) {
      if (key in source) return source[key as string];
      if (typeof key === "string" && /^[A-Z0-9_]+$/.test(key)) return 1;
      return () => ({});
    },
  });
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
    type: string,
  ) => (type.includes("webgl") ? gl : null)) as never);
  return calls;
};

describe("webglRenderer — software rasteriser", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const mount = (
    renderer: FakeRenderer,
    options: Record<string, unknown> = {},
  ) => {
    const calls = fakeWebGL(renderer);
    const reasons: WebGLUnsupportedReason[] = [];
    const opts = baseOpts({
      features: [
        webglRenderer({ ...options, onUnsupported: r => reasons.push(r) }),
      ],
    });
    const element = opts.element as HTMLElement;
    element.style.background = "rgb(20, 20, 20)";
    const engine = new BottomSheetEngine(opts as never);
    return { engine, element, reasons, calls };
  };

  it("gives its one context back when the sheet is destroyed", async () => {
    const { engine, calls } = mount({ plain: APPLE });

    engine.destroy();

    expect(calls.losses).toBe(1);
  });

  it("does not lose a context the browser has already taken", async () => {
    const { engine, calls } = mount({ plain: APPLE });
    calls.lost = true;

    engine.destroy();

    expect(calls.losses).toBe(0);
  });

  it("draws on a GPU", async () => {
    const { engine, element, reasons } = mount({ unmasked: APPLE });
    await settle();

    expect(reasons).toEqual([]);
    expect(element.getAttribute("data-bs-webgl")).toBe("on");
    expect(document.querySelectorAll("canvas").length).toBe(1);
    engine.destroy();
  });

  it("declines a context that is drawn on the CPU and says why", async () => {
    const { engine, element, reasons } = mount({ unmasked: SWIFTSHADER });
    await settle();

    expect(reasons).toEqual(["software-renderer"]);
    expect(element.hasAttribute("data-bs-webgl")).toBe(false);
    expect(element.style.background).toBe("rgb(20, 20, 20)");
    expect(document.querySelectorAll("canvas").length).toBe(0);
    engine.destroy();
  });
  it("recognises it by the plain renderer name without asking for the deprecated extension", async () => {
    const { engine, reasons, calls } = mount({
      plain: "Mesa/X.org, llvmpipe (LLVM 17.0.6, 256 bits), or similar",
      unmasked: "Mesa/X.org, llvmpipe (LLVM 17.0.6, 256 bits), or similar",
    });
    await settle();

    expect(reasons).toEqual(["software-renderer"]);
    expect(calls.extensions).not.toContain("WEBGL_debug_renderer_info");
    engine.destroy();
  });

  it("trusts a plain renderer name that names a GPU", async () => {
    const { engine, reasons, calls } = mount({
      plain: "Apple M1, or similar",
      unmasked: SWIFTSHADER,
    });
    await settle();

    expect(reasons).toEqual([]);
    expect(calls.extensions).not.toContain("WEBGL_debug_renderer_info");
    engine.destroy();
  });

  it("takes a withheld renderer name for a GPU", async () => {
    const { engine, element, reasons } = mount({ unmasked: null });
    await settle();

    expect(reasons).toEqual([]);
    expect(element.getAttribute("data-bs-webgl")).toBe("on");
    engine.destroy();
  });

  it("draws on the CPU when told to", async () => {
    const { engine, element, reasons } = mount(
      { unmasked: SWIFTSHADER },
      { allowSoftware: true },
    );
    await settle();

    expect(reasons).toEqual([]);
    expect(element.getAttribute("data-bs-webgl")).toBe("on");
    expect(document.querySelectorAll("canvas").length).toBe(1);
    engine.destroy();
  });
});
