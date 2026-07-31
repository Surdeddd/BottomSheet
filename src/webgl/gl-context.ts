export type GLHandle = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  isWebGL2: boolean;
  highp: boolean;
  destroy: () => void;
};

export const supportsHighpFragment = (gl: WebGLRenderingContext): boolean => {
  try {
    const fmt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    return !!fmt && fmt.precision > 0;
  } catch {
    return false;
  }
};

export const hasWebGL = (): boolean => {
  if (typeof document === "undefined") return false;
  if (
    typeof WebGLRenderingContext === "undefined" &&
    typeof WebGL2RenderingContext === "undefined"
  ) {
    return false;
  }
  try {
    const probe = document.createElement("canvas");
    const gl =
      probe.getContext("webgl2", { alpha: true }) ??
      probe.getContext("webgl", { alpha: true }) ??
      probe.getContext("experimental-webgl");
    if (!gl) return false;
    // Hand the context back at once. Browsers cap how many may live at a time,
    // and this one exists only to answer the question.
    const lose = (gl as WebGLRenderingContext).getExtension(
      "WEBGL_lose_context",
    );
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
};

export const createGLHandle = (onLost: () => void): GLHandle | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.pointerEvents = "none";

  const attrs: WebGLContextAttributes = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  };

  // WebGL2 first: it guarantees highp in fragment shaders and drops the
  // power-of-two texture restrictions. The shaders stay GLSL ES 1.00, which
  // WebGL2 accepts unchanged, so this is a context upgrade and nothing else.
  let gl: WebGLRenderingContext | null = null;
  let isWebGL2 = false;
  for (const id of ["webgl2", "webgl", "experimental-webgl"] as const) {
    try {
      const ctx = canvas.getContext(id, attrs) as WebGLRenderingContext | null;
      if (ctx) {
        gl = ctx;
        isWebGL2 = id === "webgl2";
        break;
      }
    } catch {
      void 0;
    }
  }
  if (!gl) return null;

  const handleLost = (e: Event): void => {
    e.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", handleLost);

  return {
    canvas,
    gl,
    isWebGL2,
    highp: isWebGL2 || supportsHighpFragment(gl),
    destroy: () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
      const lose = gl?.getExtension("WEBGL_lose_context");
      try {
        lose?.loseContext();
      } catch {
        void 0;
      }
      canvas.remove();
    },
  };
};

export const resizeDrawingBuffer = (
  handle: GLHandle,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): void => {
  const w = Math.max(1, Math.round(cssWidth * dpr));
  const h = Math.max(1, Math.round(cssHeight * dpr));
  if (handle.canvas.width !== w || handle.canvas.height !== h) {
    handle.canvas.width = w;
    handle.canvas.height = h;
  }
  handle.canvas.style.width = `${cssWidth}px`;
  handle.canvas.style.height = `${cssHeight}px`;
  handle.gl.viewport(0, 0, w, h);
};
