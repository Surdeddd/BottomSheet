import type { EngineFeature, EngineFeatureContext } from "../core/types";
import type {
  SurfaceFrame,
  WebGLRendererOptions,
  WebGLUnsupportedReason,
} from "./types";
import {
  createGLHandle,
  drawsOnCpu,
  hasWebGL,
  resizeDrawingBuffer,
  type GLHandle,
} from "./gl-context";
import {
  createSurfaceProgram,
  type ScrollLayer,
  type SurfaceProgram,
} from "./surface-program";
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

type Rgba = [number, number, number, number];
type Corners = [number, number, number, number];

const WHITE: Rgba = [1, 1, 1, 1];
const SENTINEL = "#010203";
let colorProbe: CanvasRenderingContext2D | null | undefined;

const readColor = (value: string): Rgba => {
  if (colorProbe === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorProbe = canvas.getContext("2d", { willReadFrequently: true });
  }
  const probe = colorProbe;
  if (!probe) return WHITE;
  probe.fillStyle = SENTINEL;
  probe.fillStyle = value;
  if (probe.fillStyle === SENTINEL) return WHITE;
  probe.clearRect(0, 0, 1, 1);
  probe.fillRect(0, 0, 1, 1);
  const [r = 255, g = 255, b = 255, a = 255] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255, a / 255];
};

const parseColor = (value: string): Rgba => {
  const legacy = value.match(/^rgba?\(([^()]+)\)$/);
  if (legacy && legacy[1]!.includes(",")) {
    const parts = legacy[1]!.split(",").map(p => parseFloat(p.trim()));
    const [r = 255, g = 255, b = 255, a = 1] = parts;
    return [r / 255, g / 255, b / 255, a];
  }
  return readColor(value);
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

    const readSurfaceStyle = (): { color: Rgba; radii: Corners } => {
      const cs = getComputedStyle(element);
      return {
        color: parseColor(cs.backgroundColor),
        radii: [
          parseRadius(cs.borderTopLeftRadius),
          parseRadius(cs.borderTopRightRadius),
          parseRadius(cs.borderBottomRightRadius),
          parseRadius(cs.borderBottomLeftRadius),
        ],
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

    if (!options.allowSoftware && drawsOnCpu(handle.gl)) {
      handle.destroy();
      handle = null;
      bail("software-renderer");
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
    let canvasZ = "";
    let canvasPosition = "fixed";
    const followStack = (): void => {
      if (!handle) return;
      const cs = getComputedStyle(element);
      const position = cs.position === "absolute" ? "absolute" : "fixed";
      if (position !== canvasPosition) {
        canvasPosition = position;
        handle.canvas.style.position = position;
      }
      const next =
        cs.zIndex && cs.zIndex !== "auto" ? String(Number(cs.zIndex) - 1) : "0";
      if (next === canvasZ) return;
      canvasZ = next;
      handle.canvas.style.zIndex = next;
    };
    followStack();

    suppressDomPaint();

    const dprOf = (): number => options.dpr ?? window.devicePixelRatio ?? 1;

    const releaseCapture = (): void => {
      releaseText?.();
      releaseText = null;
      if (capture && handle) {
        if (capture.texture) handle.gl.deleteTexture(capture.texture);
        if (capture.scroll) handle.gl.deleteTexture(capture.scroll.texture);
      }
      capture = null;
    };

    const fitted = (): boolean =>
      element.hasAttribute("data-bs-fit-content") &&
      element.dataset.mode === "bottom";

    const takeCapture = (): void => {
      if (!liftContent || disposed || !handle || capture) return;
      const pinned = fitted();
      const next = captureContent(handle.gl, element, dprOf(), {
        scroller: ctx.scrollContainer ?? null,
        above: pinned ? Math.max(0, ctx.getMaxAxisSize() - ctx.getSize()) : 0,
        skip: pinned ? el => el.classList.contains("bs-footer") : undefined,
      });
      if (!next) return;
      capture = next;
      releaseText = hideCapturedText(next.hiddenNodes);
    };

    const scrollLayer = (sheet: DOMRect): ScrollLayer | null => {
      const scroll = capture?.scroll;
      const scroller = ctx.scrollContainer;
      if (!scroll || !scroller) return null;
      const box = scroller.getBoundingClientRect();
      const left = box.left + scroller.clientLeft - sheet.left;
      const top = box.top + scroller.clientTop - sheet.top;
      return {
        texture: scroll.texture,
        rect: [
          left / sheet.width,
          top / sheet.height,
          (left + scroller.clientWidth) / sheet.width,
          (top + scroller.clientHeight) / sheet.height,
        ],
        map: [
          sheet.height / scroll.height,
          (scroll.above + scroller.scrollTop - scroll.top) / scroll.height,
        ],
      };
    };

    const paint = (): void => {
      if (disposed || !handle || !program) return;
      const sheet = element.getBoundingClientRect();
      const area = handle.canvas.getBoundingClientRect();
      if (sheet.width <= 0 || sheet.height <= 0) return;
      if (area.width <= 0 || area.height <= 0) return;
      const dpr = dprOf();
      resizeDrawingBuffer(handle, area.width, area.height, dpr);
      const motion = Math.min(1, Math.abs(bend) / MAX_BEND_PX);
      const frame: SurfaceFrame = {
        x: sheet.left - area.left,
        y: sheet.top - area.top,
        width: sheet.width,
        height: sheet.height,
        radii: surfaceStyle.radii,
        color: surfaceStyle.color,
        shadow: shadowStrength,
      };
      program.draw(frame, {
        bend,
        dpr,
        sheen: sheenStrength,
        glass: glassStrength * motion,
        content: capture?.texture ?? null,
        scroll: scrollLayer(sheet),
      });
    };

    const tick = (): void => {
      if (disposed) return;
      const held = ctx.isDragging();
      if (held || !ctx.isAnimating()) paint();
      bend *= held ? BEND_DECAY_HELD : BEND_DECAY_FREE;
      const flat = Math.abs(bend) < BEND_REST;

      if (!held && flat && capture) {
        bend = 0;
        releaseCapture();
        paint();
      }

      if (!held && flat && !ctx.isAnimating()) {
        bend = 0;
        paint();
        running = false;
        frameId = null;
        queueRefresh();
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
        queueMicrotask(takeCapture);
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

    const onGeometry = (): void => {
      followStack();
      if (!ctx.isDragging()) paint();
      wake();
    };
    const geometryObserver = new MutationObserver(onGeometry);
    geometryObserver.observe(element, {
      attributes: true,
      attributeFilter: ["style"],
    });

    const refreshSurfaceStyle = (): boolean => {
      const moved = geometryObserver.takeRecords().length > 0;
      const style = element.style;
      const transition = style.transition;
      style.transition = "none";
      style.background = painted.background;
      style.boxShadow = painted.boxShadow;
      const next = readSurfaceStyle();
      style.background = "transparent";
      style.boxShadow = "none";
      void getComputedStyle(element).backgroundColor;
      style.transition = transition;
      geometryObserver.takeRecords();
      const changed =
        next.radii.some((radius, i) => radius !== surfaceStyle.radii[i]) ||
        next.color.some((channel, i) => channel !== surfaceStyle.color[i]);
      surfaceStyle = next;
      if (!moved) {
        followStack();
        return changed;
      }
      onGeometry();
      return false;
    };

    let refreshQueued = false;
    const queueRefresh = (): void => {
      if (disposed || refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => {
        refreshQueued = false;
        if (!disposed && refreshSurfaceStyle()) paint();
      });
    };

    const onThemeSignal = (): void => {
      if (!ctx.isDragging() && !ctx.isAnimating()) queueRefresh();
    };
    const themeObserver = new MutationObserver(onThemeSignal);
    themeObserver.observe(element, {
      attributes: true,
      attributeFilter: ["class"],
    });
    for (let node = element.parentElement; node; node = node.parentElement) {
      themeObserver.observe(node, { attributes: true });
    }
    const scheme =
      typeof matchMedia === "function"
        ? matchMedia("(prefers-color-scheme: dark)")
        : null;
    scheme?.addEventListener?.("change", onThemeSignal);

    const onResize = (): void => {
      if (disposed) return;
      refreshSurfaceStyle();
      paint();
    };
    window.addEventListener("resize", onResize, { passive: true });

    paint();

    return () => {
      contentObserver.disconnect();
      geometryObserver.disconnect();
      themeObserver.disconnect();
      scheme?.removeEventListener?.("change", onThemeSignal);
      window.removeEventListener("resize", onResize);
      teardown();
    };
  },
});
