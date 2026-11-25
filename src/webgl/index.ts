import type { EngineFeature, EngineFeatureContext } from "../core/types";
import type {
  SurfaceFrame,
  WebGLRendererOptions,
  WebGLUnsupportedReason,
} from "./types";
import { createBend, type Bend } from "./bend";
import { onGrid } from "./pixel-grid";
import {
  createGLHandle,
  drawsOnCpu,
  hasWebGL,
  resizeDrawingBuffer,
  type GLHandle,
} from "./gl-context";
import {
  createSurfaceProgram,
  type ContentLayer,
  type ScrollLayer,
  type SurfaceProgram,
} from "./surface-program";
import type { ContentCapture } from "./content-texture";
import type { Lifter } from "./lift";

export { contentLift } from "./lift";
export type {
  ContentLift,
  WebGLRendererOptions,
  WebGLUnsupportedReason,
} from "./types";

const DEFAULT_JELLY = 0.5;
const DEFAULT_SHADOW = 1;
const DEFAULT_SHEEN = 0.35;
const DEFAULT_GLASS = 0.6;
const GLASS_FULL_PX = 22;
const HANDBACK_MS = 40;
const HANDBACK_PER_FRAME = 0.62;
const MAX_FRAME_MS = 64;
const FLAT_PX = 0.35;
const LIFT_PX = 0.5;

type Edge = { position: number; axis: 0 | 1; inward: 1 | -1 };
type Pixel = { x: number; y: number };

const edgeOf = (mode: string | undefined, rect: DOMRect): Edge => {
  if (mode === "top") return { position: rect.bottom, axis: 0, inward: -1 };
  if (mode === "left") return { position: rect.right, axis: 1, inward: -1 };
  if (mode === "right") return { position: rect.left, axis: 1, inward: 1 };
  return { position: rect.top, axis: 0, inward: 1 };
};

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

const parentAcrossShadow = (node: Element): Element | null =>
  node.parentElement ??
  (node.getRootNode() as Partial<ShadowRoot>).host ??
  null;

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
    const lifter = (options.lift as unknown as Lifter | undefined) ?? null;

    let handle: GLHandle | null = null;
    let program: SurfaceProgram | null = null;
    let frameId: number | null = null;
    let running = false;
    let bend: Bend | null = null;
    let inward = 0;
    let offset = 0;
    let axis: 0 | 1 = 0;
    let drive = 1;
    let edgeSeen = Number.NaN;
    let wasMoving = false;
    let tickedAt = 0;
    let drawnSinceTick = false;
    let disposed = false;
    let capture: ContentCapture | null = null;
    let releaseText: (() => void) | null = null;
    let lifted = false;
    let heldAt = 0;
    let shown = 0;

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
      lifted = false;
      if (capture && handle) {
        if (capture.texture) handle.gl.deleteTexture(capture.texture);
        if (capture.scroll) handle.gl.deleteTexture(capture.scroll.texture);
      }
      capture = null;
    };

    const handBack = (): void => {
      const style = element.style;
      if (lifted && style.willChange === "") {
        style.willChange = "transform";
        requestAnimationFrame(() => {
          if (ctx.isDragging() || ctx.isAnimating()) return;
          style.willChange = "";
        });
      }
      releaseCapture();
    };

    const fitted = (): boolean =>
      element.hasAttribute("data-bs-fit-content") &&
      element.dataset.mode === "bottom";

    const takeCapture = (): void => {
      if (!lifter || jelly <= 0 || disposed || !handle || capture) return;
      const pinned = fitted();
      const next = lifter.capture(handle.gl, element, dprOf(), {
        scroller: ctx.scrollContainer ?? null,
        above: pinned ? Math.max(0, ctx.getMaxAxisSize() - ctx.getSize()) : 0,
        skip: pinned ? el => el.classList.contains("bs-footer") : undefined,
      });
      if (!next) return;
      capture = next;
      heldAt = edgeOf(
        element.dataset.mode,
        element.getBoundingClientRect(),
      ).position;
    };

    const lift = (): void => {
      if (!lifter || !capture || lifted) return;
      lifted = true;
      releaseText = lifter.hide(capture.hiddenNodes);
    };

    const liftOnceMoved = (sheet: DOMRect): void => {
      if (!capture || lifted) return;
      const edge = edgeOf(element.dataset.mode, sheet).position;
      if (Math.abs(edge - heldAt) >= LIFT_PX) lift();
    };

    const contentLayer = (dpr: number, at: Pixel): ContentLayer | null => {
      if (!lifted || !capture?.texture) return null;
      const { x, y, w, h } = capture.box;
      return {
        texture: capture.texture,
        box: [onGrid(at.x, x * dpr), onGrid(at.y, y * dpr), w * dpr, h * dpr],
      };
    };

    const scrollLayer = (
      sheet: DOMRect,
      dpr: number,
      at: Pixel,
    ): ScrollLayer | null => {
      const scroll = lifted ? capture?.scroll : null;
      const scroller = ctx.scrollContainer;
      if (!scroll || !scroller) return null;
      const box = scroller.getBoundingClientRect();
      const left = box.left + scroller.clientLeft - sheet.left;
      const top = box.top + scroller.clientTop - sheet.top;
      const scrolled = scroller.scrollTop - scroll.top;
      return {
        texture: scroll.texture,
        clip: [
          onGrid(at.x, left * dpr),
          onGrid(at.y, top * dpr),
          onGrid(at.x, (left + scroller.clientWidth) * dpr),
          onGrid(at.y, (top + scroller.clientHeight) * dpr),
        ],
        box: [
          onGrid(at.x, (left + scroll.box.x) * dpr),
          onGrid(at.y, (top + scroll.box.y - scroll.above - scrolled) * dpr),
          scroll.box.w * dpr,
          scroll.box.h * dpr,
        ],
      };
    };

    const paint = (rect?: DOMRect): void => {
      if (disposed || !handle || !program) return;
      const sheet = rect ?? element.getBoundingClientRect();
      const area = handle.canvas.getBoundingClientRect();
      if (sheet.width <= 0 || sheet.height <= 0) return;
      if (area.width <= 0 || area.height <= 0) return;
      const dpr = dprOf();
      resizeDrawingBuffer(handle, area.width, area.height, dpr);
      liftOnceMoved(sheet);
      const motion = Math.min(1, Math.abs(offset) / GLASS_FULL_PX);
      const frame: SurfaceFrame = {
        x: sheet.left - area.left,
        y: sheet.top - area.top,
        width: sheet.width,
        height: sheet.height,
        radii: surfaceStyle.radii,
        color: surfaceStyle.color,
        shadow: shadowStrength,
      };
      const at: Pixel = { x: frame.x * dpr, y: frame.y * dpr };
      shown = offset;
      program.draw(frame, {
        bend: offset,
        axis,
        lead: inward < 0 ? -1 : 1,
        dpr,
        sheen: sheenStrength,
        glass: glassStrength * motion,
        content: contentLayer(dpr, at),
        scroll: scrollLayer(sheet, dpr, at),
      });
    };

    const inTransition = (): boolean =>
      typeof element.getAnimations === "function" &&
      element.getAnimations().some(running => "transitionProperty" in running);

    const tick = (): void => {
      if (disposed) return;
      const now = performance.now();
      const elapsed = Math.min(now - tickedAt, MAX_FRAME_MS);
      tickedAt = now;
      const sheet = element.getBoundingClientRect();
      const edge = edgeOf(element.dataset.mode, sheet);
      if (!bend || edge.inward !== inward || edge.axis !== axis) {
        bend = createBend({ jelly, inward: edge.inward });
        bend.reset(edge.position, now);
        inward = edge.inward;
        axis = edge.axis;
      }
      const held = ctx.isDragging();
      const moving = held || ctx.isAnimating();
      if (!moving && !wasMoving && edge.position !== edgeSeen) {
        bend.reset(edge.position, now);
      }
      wasMoving = moving;
      edgeSeen = edge.position;
      const lag = bend.step(edge.position, now);

      const handingBack = !!capture && !held;
      const kept = Math.exp(-elapsed / HANDBACK_MS);
      drive = handingBack
        ? drive * Math.min(kept, HANDBACK_PER_FRAME)
        : 1 - (1 - drive) * kept;
      offset = lag * drive;

      let stale = !drawnSinceTick;
      drawnSinceTick = false;
      if (handingBack && Math.abs(offset) < FLAT_PX) {
        handBack();
        stale = true;
      }
      if (stale) paint(sheet);

      if (!moving && !capture && bend.rest() && !inTransition()) {
        offset = 0;
        if (shown !== 0) paint(sheet);
        drive = 1;
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
      tickedAt = performance.now();
      frameId = requestAnimationFrame(tick);
    };

    ctx.addTeardown(ctx.on("drag", wake));
    ctx.addTeardown(
      ctx.on("dragstart", () => {
        if (lifter) queueMicrotask(takeCapture);
        wake();
      }),
    );
    ctx.addTeardown(ctx.on("dragend", wake));
    ctx.addTeardown(ctx.on("progress", wake));
    ctx.addTeardown(ctx.on("snap", wake));

    const onTransition = (event: Event): void => {
      if (event.target === element) wake();
    };
    element.addEventListener("transitionrun", onTransition);

    const contentObserver = new MutationObserver(() => {
      if (!capture) return;
      const shown = lifted;
      releaseCapture();
      takeCapture();
      if (shown) lift();
    });
    contentObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const onGeometry = (): void => {
      followStack();
      paint();
      drawnSinceTick = true;
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
      restoreDom();
      const next = readSurfaceStyle();
      suppressDomPaint();
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
    for (
      let node = parentAcrossShadow(element);
      node;
      node = parentAcrossShadow(node)
    ) {
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
      element.removeEventListener("transitionrun", onTransition);
      scheme?.removeEventListener?.("change", onThemeSignal);
      window.removeEventListener("resize", onResize);
      teardown();
    };
  },
});
