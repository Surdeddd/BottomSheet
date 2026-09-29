export type ScrollCapture = {
  texture: WebGLTexture;
  top: number;
  above: number;
  height: number;
};

export type ContentCapture = {
  texture: WebGLTexture | null;
  width: number;
  height: number;
  hiddenNodes: HTMLElement[];
  scroll: ScrollCapture | null;
};

export type CaptureOptions = {
  scroller?: HTMLElement | null;
  above?: number;
  skip?: (el: HTMLElement) => boolean;
};

type Layer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

type Origin = { x: number; y: number; height: number };

const SKIP_TAGS = new Set([
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "IMG",
  "SVG",
  "CANVAS",
  "VIDEO",
  "IFRAME",
  "BUTTON",
]);

const isRenderable = (el: HTMLElement): boolean => {
  if (SKIP_TAGS.has(el.tagName)) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || cs.display === "none") return false;
  if (parseFloat(cs.opacity) < 0.05) return false;
  return true;
};

const directText = (el: HTMLElement): string => {
  let out = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? "";
  }
  return out.trim();
};

const wrapLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = words[i]!;
    }
  }
  lines.push(line);
  return lines;
};

const isPaintedColor = (value: string): boolean =>
  !!value && value !== "transparent" && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(value);

const roundedPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (rad <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
};

const drawBox = (
  ctx: CanvasRenderingContext2D,
  cs: CSSStyleDeclaration,
  rect: DOMRect,
  origin: Origin,
): boolean => {
  const bg = cs.backgroundColor;
  const borderWidth = parseFloat(cs.borderTopWidth) || 0;
  const hasBorder = borderWidth > 0 && isPaintedColor(cs.borderTopColor);
  if (!isPaintedColor(bg) && !hasBorder) return false;

  const x = rect.left - origin.x;
  const y = rect.top - origin.y;
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;

  if (isPaintedColor(bg)) {
    roundedPath(ctx, x, y, rect.width, rect.height, radius);
    ctx.fillStyle = bg;
    ctx.fill();
  }
  if (hasBorder) {
    roundedPath(ctx, x, y, rect.width, rect.height, radius);
    ctx.strokeStyle = cs.borderTopColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }
  return true;
};

const drawImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: DOMRect,
  origin: Origin,
): boolean => {
  if (!img.complete || img.naturalWidth === 0) return false;
  try {
    ctx.drawImage(
      img,
      rect.left - origin.x,
      rect.top - origin.y,
      rect.width,
      rect.height,
    );
    return true;
  } catch {
    return false;
  }
};

const createLayer = (
  width: number,
  height: number,
  scale: number,
): Layer | null => {
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  if (w < 2 || h < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  return { canvas, ctx };
};

const paintTree = (
  ctx: CanvasRenderingContext2D,
  walker: TreeWalker,
  origin: Origin,
  hidden: HTMLElement[],
): number => {
  let painted = 0;
  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement;
    const isImage = el.tagName === "IMG";
    if (!isImage && !isRenderable(el)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (rect.bottom <= origin.y || rect.top >= origin.y + origin.height) {
      continue;
    }

    if (isImage) {
      if (drawImage(ctx, el as HTMLImageElement, rect, origin)) {
        painted++;
        hidden.push(el);
      }
      continue;
    }

    const cs = getComputedStyle(el);
    const boxed = drawBox(ctx, cs, rect, origin);
    if (boxed) {
      painted++;
      hidden.push(el);
    }

    const text = directText(el);
    if (!text) continue;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.fillStyle = cs.color;
    ctx.textBaseline = "top";

    const padLeft = parseFloat(cs.paddingLeft) || 0;
    const padTop = parseFloat(cs.paddingTop) || 0;
    const innerWidth = Math.max(
      1,
      rect.width - padLeft - (parseFloat(cs.paddingRight) || 0),
    );
    const lineHeight =
      parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;

    const x = rect.left - origin.x + padLeft;
    const y = rect.top - origin.y + padTop;

    const lines = wrapLines(ctx, text, innerWidth);
    lines.forEach((line, i) => {
      const lineY = y + i * lineHeight;
      if (lineY > origin.height) return;
      let lineX = x;
      if (cs.textAlign === "center") {
        lineX = x + (innerWidth - ctx.measureText(line).width) / 2;
      } else if (cs.textAlign === "right") {
        lineX = x + innerWidth - ctx.measureText(line).width;
      }
      ctx.fillText(line, lineX, lineY);
    });

    if (lines.length) {
      painted++;
      if (!boxed) hidden.push(el);
    }
  }
  return painted;
};

const upload = (
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
): WebGLTexture | null => {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  try {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvas,
    );
  } catch {
    gl.deleteTexture(texture);
    return null;
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
};

const scaleFor = (
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  dpr: number,
): number => {
  const max = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
  return Math.min(dpr, max / Math.max(width, height, 1));
};

const captureScroll = (
  gl: WebGLRenderingContext,
  scroller: HTMLElement,
  dpr: number,
  requestedAbove: number,
  skip: CaptureOptions["skip"],
  hidden: HTMLElement[],
): ScrollCapture | null => {
  const box = scroller.getBoundingClientRect();
  const width = scroller.clientWidth;
  const view = scroller.clientHeight;
  if (width < 1 || view < 1) return null;
  const top = scroller.scrollTop;
  const above = Math.max(0, Math.min(requestedAbove, top));
  const height = view + above;
  const layer = createLayer(width, height, scaleFor(gl, width, height, dpr));
  if (!layer) return null;

  const origin: Origin = {
    x: box.left + scroller.clientLeft,
    y: box.top + scroller.clientTop - above,
    height,
  };
  const walker = document.createTreeWalker(scroller, NodeFilter.SHOW_ELEMENT, {
    acceptNode: node =>
      skip?.(node as HTMLElement)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const drawn: HTMLElement[] = [];
  if (!paintTree(layer.ctx, walker, origin, drawn)) return null;
  const texture = upload(gl, layer.canvas);
  if (!texture) return null;
  hidden.push(...drawn);
  return { texture, top, above, height };
};

export const captureContent = (
  gl: WebGLRenderingContext,
  root: HTMLElement,
  dpr: number,
  options: CaptureOptions = {},
): ContentCapture | null => {
  const rootRect = root.getBoundingClientRect();
  const scroller =
    options.scroller && options.scroller !== root && root.contains(options.scroller)
      ? options.scroller
      : null;
  const skip = options.skip;

  const hiddenNodes: HTMLElement[] = [];
  let texture: WebGLTexture | null = null;
  const layer = createLayer(
    rootRect.width,
    rootRect.height,
    scaleFor(gl, rootRect.width, rootRect.height, dpr),
  );
  if (layer) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: node => {
        const el = node as HTMLElement;
        if (scroller && el.parentElement === scroller) {
          return NodeFilter.FILTER_REJECT;
        }
        return skip?.(el) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const drawn: HTMLElement[] = [];
    const origin: Origin = {
      x: rootRect.left,
      y: rootRect.top,
      height: rootRect.height,
    };
    if (paintTree(layer.ctx, walker, origin, drawn)) {
      texture = upload(gl, layer.canvas);
      if (texture) hiddenNodes.push(...drawn);
    }
  }

  const scroll = scroller
    ? captureScroll(gl, scroller, dpr, options.above ?? 0, skip, hiddenNodes)
    : null;

  if (!texture && !scroll) return null;
  return {
    texture,
    width: layer?.canvas.width ?? 0,
    height: layer?.canvas.height ?? 0,
    hiddenNodes,
    scroll,
  };
};

export const hideCapturedText = (nodes: HTMLElement[]): (() => void) => {
  const restore = nodes.map(el => ({
    el,
    color: el.style.color,
    background: el.style.background,
    borderColor: el.style.borderColor,
    opacity: el.style.opacity,
    isImage: el.tagName === "IMG",
  }));
  for (const entry of restore) {
    if (entry.isImage) {
      entry.el.style.opacity = "0";
      continue;
    }
    entry.el.style.color = "transparent";
    entry.el.style.background = "transparent";
    entry.el.style.borderColor = "transparent";
  }
  return () => {
    for (const entry of restore) {
      entry.el.style.color = entry.color;
      entry.el.style.background = entry.background;
      entry.el.style.borderColor = entry.borderColor;
      entry.el.style.opacity = entry.opacity;
    }
  };
};
