export type ContentCapture = {
  texture: WebGLTexture;
  width: number;
  height: number;
  hiddenNodes: HTMLElement[];
};

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
  rootRect: DOMRect,
): boolean => {
  const bg = cs.backgroundColor;
  const borderWidth = parseFloat(cs.borderTopWidth) || 0;
  const hasBorder = borderWidth > 0 && isPaintedColor(cs.borderTopColor);
  if (!isPaintedColor(bg) && !hasBorder) return false;

  const x = rect.left - rootRect.left;
  const y = rect.top - rootRect.top;
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
  rootRect: DOMRect,
): boolean => {
  if (!img.complete || img.naturalWidth === 0) return false;
  const rect = img.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  try {
    ctx.drawImage(
      img,
      rect.left - rootRect.left,
      rect.top - rootRect.top,
      rect.width,
      rect.height,
    );
    return true;
  } catch {
    return false;
  }
};

export const captureContent = (
  gl: WebGLRenderingContext,
  root: HTMLElement,
  dpr: number,
): ContentCapture | null => {
  const rootRect = root.getBoundingClientRect();
  const w = Math.max(1, Math.round(rootRect.width * dpr));
  const h = Math.max(1, Math.round(rootRect.height * dpr));
  if (w < 2 || h < 2) return null;

  const surface = document.createElement("canvas");
  surface.width = w;
  surface.height = h;
  const ctx = surface.getContext("2d");
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  const hiddenNodes: HTMLElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let painted = 0;

  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement;

    if (el.tagName === "IMG") {
      if (drawImage(ctx, el as HTMLImageElement, rootRect)) {
        painted++;
        hiddenNodes.push(el);
      }
      continue;
    }

    if (!isRenderable(el)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;

    const cs = getComputedStyle(el);
    const boxed = drawBox(ctx, cs, rect, rootRect);
    if (boxed) {
      painted++;
      hiddenNodes.push(el);
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

    const x = rect.left - rootRect.left + padLeft;
    const y = rect.top - rootRect.top + padTop;

    const lines = wrapLines(ctx, text, innerWidth);
    lines.forEach((line, i) => {
      const lineY = y + i * lineHeight;
      if (lineY > rootRect.height) return;
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
      if (!boxed) hiddenNodes.push(el);
    }
  }

  if (!painted) return null;

  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  try {
    // A cross-origin image without CORS headers taints the canvas, and the
    // upload throws only here — drawImage itself succeeds. Losing the texture
    // is the correct outcome: the sheet keeps its DOM content and simply does
    // not deform it.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      surface,
    );
  } catch {
    gl.deleteTexture(texture);
    return null;
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { texture, width: w, height: h, hiddenNodes };
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
