const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const MASKED = /^webkit webgl$/i;

type Gl = WebGLRenderingContext | WebGL2RenderingContext;

let probed: boolean | null = null;

export const isSoftwareRenderer = (name: string): boolean =>
  SOFTWARE.test(name);

const rendererName = (gl: Gl): string => {
  const plain: unknown = gl.getParameter(gl.RENDERER);
  if (typeof plain === "string" && plain && !MASKED.test(plain)) return plain;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const raw: unknown = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
  return typeof raw === "string" ? raw : "";
};

const probe = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as Gl | null;
    if (!gl) return false;
    const hardware = !isSoftwareRenderer(rendererName(gl));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return hardware;
  } catch {
    return false;
  }
};

export const hasHardwareWebGL = (): boolean => {
  probed ??= probe();
  return probed;
};

export const resetHardwareProbe = (): void => {
  probed = null;
};
