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
    if (!isRenderable(el)) continue;
    const text = directText(el);
    if (!text) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;

    const cs = getComputedStyle(el);
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
      hiddenNodes.push(el);
    }
  }

  if (!painted) return null;

  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    surface,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { texture, width: w, height: h, hiddenNodes };
};

export const hideCapturedText = (nodes: HTMLElement[]): (() => void) => {
  const restore = nodes.map(el => ({ el, prev: el.style.color }));
  for (const { el } of restore) el.style.color = "transparent";
  return () => {
    for (const { el, prev } of restore) el.style.color = prev;
  };
};
