import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasHardwareWebGL,
  isSoftwareRenderer,
  resetHardwareProbe,
} from "../../demo/lib/hero-3d/capability";

const SOFTWARE = [
  "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)",
  "Google SwiftShader",
  "llvmpipe (LLVM 15.0.7, 256 bits)",
  "Mesa/X.org, llvmpipe (LLVM 17.0.6, 256 bits), or similar",
  "softpipe",
  "Microsoft Basic Render Driver",
  "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)",
  "Software Rasterizer",
];

const HARDWARE = [
  "Apple GPU",
  "Apple M1, or similar",
  "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)",
  "ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 Direct3D11 vs_5_0 ps_5_0, D3D11)",
  "ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)",
  "Mali-G78",
  "Adreno (TM) 660",
  "",
];

type FakeGl = {
  RENDERER: number;
  getExtension: (name: string) => unknown;
  getParameter: (id: number) => unknown;
};

const fakeGl = (unmasked: string | null, plain = ""): FakeGl & { lost: number } => {
  const gl = {
    RENDERER: 7937,
    lost: 0,
    getExtension(name: string) {
      if (name === "WEBGL_debug_renderer_info") {
        return unmasked === null ? null : { UNMASKED_RENDERER_WEBGL: 37446 };
      }
      if (name === "WEBGL_lose_context") {
        return { loseContext: () => (gl.lost += 1) };
      }
      return null;
    },
    getParameter(id: number) {
      if (id === 37446) return unmasked;
      if (id === 7937) return plain;
      return null;
    },
  };
  return gl;
};

const withContext = (gl: unknown): void => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    (() => gl) as never,
  );
};

describe("the demo's 3D stage and software WebGL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetHardwareProbe();
  });

  it("recognises a software rasteriser by the renderer's name", () => {
    expect(SOFTWARE.filter(name => !isSoftwareRenderer(name))).toEqual([]);
  });

  it("leaves real GPUs and unknown names alone", () => {
    expect(HARDWARE.filter(name => isSoftwareRenderer(name))).toEqual([]);
  });

  it("refuses the stage when WebGL is drawn on the CPU", () => {
    withContext(fakeGl(SOFTWARE[0]!));
    expect(hasHardwareWebGL()).toBe(false);
  });

  it("allows the stage on a GPU", () => {
    withContext(fakeGl("ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro)"));
    expect(hasHardwareWebGL()).toBe(true);
  });

  it("reads the plain renderer name where the unmasked one is withheld", () => {
    withContext(fakeGl(null, "Mesa/X.org, llvmpipe (LLVM 17.0.6, 256 bits), or similar"));
    expect(hasHardwareWebGL()).toBe(false);
  });

  it("refuses the stage when there is no WebGL at all", () => {
    withContext(null);
    expect(hasHardwareWebGL()).toBe(false);
  });

  it("gives the probe's context back and asks only once", () => {
    const gl = fakeGl("Apple GPU");
    withContext(gl);
    expect(hasHardwareWebGL()).toBe(true);
    expect(hasHardwareWebGL()).toBe(true);
    expect(gl.lost).toBe(1);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(1);
  });
});
