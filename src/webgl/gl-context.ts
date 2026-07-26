export type GLHandle = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  destroy: () => void;
};

export const hasWebGL = (): boolean => {
  if (typeof document === "undefined") return false;
  if (typeof WebGLRenderingContext === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const gl =
      probe.getContext("webgl", { alpha: true }) ??
      probe.getContext("experimental-webgl");
    if (!gl) return false;
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

  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;
  } catch {
    gl = null;
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
