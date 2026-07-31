import type { EngineFeature, EngineFeatureContext } from "../core/types";
import type {
  SurfaceFrame,
  WebGLRendererOptions,
  WebGLUnsupportedReason,
} from "./types";
import {
  createGLHandle,
  hasWebGL,
  resizeDrawingBuffer,
  type GLHandle,
} from "./gl-context";
import { createSurfaceProgram, type SurfaceProgram } from "./surface-program";
import {
  captureContent,
  hideCapturedText,
  type ContentCapture,
} from "./content-texture";

export type { WebGLRendererOptions, WebGLUnsupportedReason } from "./types";

const DEFAULT_JELLY = 0.5;
const DEFAULT_SHADOW = 1;
const DEFAULT_SHEEN = 0.35;
const DEFAULT_GLASS = 0.6;
const MAX_BEND_PX = 22;
const BEND_DECAY_HELD = 0.86;
const BEND_DECAY_FREE = 0.62;
const BEND_REST = 0.35;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const parseColor = (value: string): [number, number, number, number] => {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return [1, 1, 1, 1];
  const parts = m[1]!.split(",").map(p => parseFloat(p.trim()));
  const [r = 255, g = 255, b = 255, a = 1] = parts;
  return [r / 255, g / 255, b / 255, a];
};

const parseRadius = (value: string): number => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export const webglRenderer = (
  options: WebGLRendererOptions = {},
): EngineFeature => ({
  name: "webgl-renderer",
  stage: "post",
  install: (ctx: EngineFeatureContext) => {
    const bail = (reason: WebGLUnsupportedReason): void => {
      options.onUnsupported?.(reason);
    };

    if (typeof document === "undefined" || typeof window === "undefined") {
      bail("no-document");
      return;
    }
    if (prefersReducedMotion()) {
      bail("reduced-motion");
      return;
    }
    if (!hasWebGL()) {
      bail("no-webgl");
      return;
    }

    const element = ctx.element;
    const jelly = options.jelly ?? DEFAULT_JELLY;
    const shadowStrength = options.shadow ?? DEFAULT_SHADOW;
    const sheenStrength = options.sheen ?? DEFAULT_SHEEN;
    const glassStrength = options.glass ?? DEFAULT_GLASS;
    const liftContent = options.liftContent !== false;

    let handle: GLHandle | null = null;
    let program: SurfaceProgram | null = null;
    let frameId: number | null = null;
    let running = false;
    let bend = 0;
    let disposed = false;
    let capture: ContentCapture | null = null;
    let releaseText: (() => void) | null = null;

    const painted = {
      background: element.style.background,
      boxShadow: element.style.boxShadow,
    };

    const readSurfaceStyle = (): { color: [number, number, number, number]; radius: number } => {
      const cs = getComputedStyle(element);
      return {
        color: parseColor(cs.backgroundColor),
        radius: parseRadius(cs.borderTopLeftRadius),
      };
    };

    let surfaceStyle = readSurfaceStyle();

    const restoreDom = (): void => {
      element.style.background = painted.background;
      element.style.boxShadow = painted.boxShadow;
      element.removeAttribute("data-bs-webgl");
    };

    const suppressDomPaint = (): void => {
      element.setAttribute("data-bs-webgl", "on");
      element.style.background = "transparent";
      element.style.boxShadow = "none";
    };

    const teardown = (reason?: WebGLUnsupportedReason): void => {
      if (disposed) return;
      disposed = true;
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      releaseCapture();
      program?.destroy();
      program = null;
      handle?.destroy();
      handle = null;
      restoreDom();
      if (reason) bail(reason);
    };

    handle = createGLHandle(() => teardown("context-lost"));
    if (!handle) {
      bail("no-webgl");
      return;
    }

    program = createSurfaceProgram(handle.gl, handle.highp);
    if (!program) {
      handle.destroy();
      handle = null;
      bail("no-webgl");
      return;
    }

    const parent = element.parentElement ?? document.body;
    parent.insertBefore(handle.canvas, element);
    const elementZ = getComputedStyle(element).zIndex;
    handle.canvas.style.zIndex =
      elementZ && elementZ !== "auto" ? String(Number(elementZ) - 1) : "0";

    suppressDomPaint();

    const readFrame = (): SurfaceFrame | null => {
      if (!handle) return null;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        radius: surfaceStyle.radius,
        color: surfaceStyle.color,
        shadow: shadowStrength,
      };
    };

    const dprOf = (): number => options.dpr ?? window.devicePixelRatio ?? 1;

    const releaseCapture = (): void => {
      releaseText?.();
      releaseText = null;
      if (capture && handle) handle.gl.deleteTexture(capture.texture);
      capture = null;
    };

    const takeCapture = (): void => {
      if (!liftContent || disposed || !handle || capture) return;
      const next = captureContent(handle.gl, element, dprOf());
      if (!next) return;
      capture = next;
      releaseText = hideCapturedText(next.hiddenNodes);
    };

    const paint = (): void => {
      if (disposed || !handle || !program) return;
      const frame = readFrame();
      if (!frame) return;
      const dpr = dprOf();
      resizeDrawingBuffer(handle, window.innerWidth, window.innerHeight, dpr);
      const motion = Math.min(1, Math.abs(bend) / MAX_BEND_PX);
      program.draw(frame, {
        bend,
        dpr,
        sheen: sheenStrength,
        glass: glassStrength * motion,
        content: capture?.texture ?? null,
      });
    };

    const tick = (): void => {
      if (disposed) return;
      paint();
      const held = ctx.isDragging();
      bend *= held ? BEND_DECAY_HELD : BEND_DECAY_FREE;
      const settled =
        !held && !ctx.isAnimating() && Math.abs(bend) < BEND_REST;
      if (settled) {
        bend = 0;
        releaseCapture();
        paint();
        running = false;
        frameId = null;
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    const wake = (): void => {
      if (disposed || running) return;
      running = true;
      frameId = requestAnimationFrame(tick);
    };

    ctx.addTeardown(
      ctx.on("drag", payload => {
        const velocity = (payload as { delta?: number }).delta ?? 0;
        bend = Math.max(
          -MAX_BEND_PX,
          Math.min(MAX_BEND_PX, velocity * jelly * 0.35),
        );
        wake();
      }),
    );
    ctx.addTeardown(
      ctx.on("dragstart", () => {
        takeCapture();
        wake();
      }),
    );
    ctx.addTeardown(ctx.on("dragend", wake));
    ctx.addTeardown(ctx.on("progress", wake));
    ctx.addTeardown(ctx.on("snap", wake));

    const contentObserver = new MutationObserver(() => {
      if (!capture) return;
      releaseCapture();
      takeCapture();
    });
    contentObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const refreshSurfaceStyle = (): void => {
      if (disposed) return;
      element.style.background = painted.background;
      element.style.boxShadow = painted.boxShadow;
      surfaceStyle = readSurfaceStyle();
      element.style.background = "transparent";
      element.style.boxShadow = "none";
    };

    const onResize = (): void => {
      if (disposed) return;
      refreshSurfaceStyle();
      paint();
    };
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onResize, { passive: true });

    paint();

    return () => {
      contentObserver.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
      teardown();
    };
  },
});
