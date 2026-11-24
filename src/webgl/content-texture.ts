import { snapTo, snapsToScreen } from "./pixel-grid";

export type Area = { x: number; y: number; w: number; h: number };

export type ScrollCapture = {
  texture: WebGLTexture;
  top: number;
  above: number;
  box: Area;
};

export type Lifted = {
  el: HTMLElement;
  text: boolean;
  box: boolean;
  image: boolean;
};

export type ContentCapture = {
  texture: WebGLTexture | null;
  box: Area;
  hiddenNodes: Lifted[];
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

type Anchor = { x: number; y: number; screen: boolean };
type Origin = {
  x: number;
  y: number;
  height: number;
  sx: (value: number) => number;
  sy: (value: number) => number;
};
type Box = { left: number; top: number; right: number; bottom: number };
type Corners = [number, number, number, number];

type Ruler = {
  ascent: (cs: CSSStyleDeclaration) => number | null;
  done: () => void;
};

type Pass = {
  ctx: CanvasRenderingContext2D;
  origin: Origin;
  lifted: Lifted[];
  ruler: Ruler;
  skip?: (el: HTMLElement) => boolean;
  outside?: HTMLElement | null;
};

const STAY_TAGS = /* @__PURE__ */ new Set([
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "CANVAS",
  "VIDEO",
  "IFRAME",
  "BUTTON",
  "OBJECT",
  "EMBED",
]);

const SIDES = ["Top", "Right", "Bottom", "Left"] as const;

const isPaintedColor = (value: string): boolean =>
  !!value &&
  value !== "transparent" &&
  !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(value);

const px = (value: string): number => parseFloat(value) || 0;

const unset = (value: string | undefined, initial: string): boolean =>
  !value || value === initial;

const lineOf = (cs: CSSStyleDeclaration, side: (typeof SIDES)[number]): number =>
  unset(cs[`border${side}Style`], "none") ? 0 : px(cs[`border${side}Width`]);

const borderOf = (
  cs: CSSStyleDeclaration,
): { width: number; color: string; plain: boolean } => {
  const widths = SIDES.map(side => lineOf(cs, side));
  const width = widths[0]!;
  const color = cs.borderTopColor;
  const even = widths.every(w => w === width);
  const oneColor = SIDES.every(side => cs[`border${side}Color`] === color);
  const solid = SIDES.every(side => {
    const style = cs[`border${side}Style`];
    return unset(style, "none") || style === "solid";
  });
  const drawn = widths.some(w => w > 0);
  return {
    width: drawn && isPaintedColor(color) ? width : 0,
    color,
    plain: !drawn || (even && oneColor && solid),
  };
};

const paintsBox = (cs: CSSStyleDeclaration): boolean =>
  isPaintedColor(cs.backgroundColor) ||
  !unset(cs.backgroundImage, "none") ||
  !unset(cs.boxShadow, "none") ||
  SIDES.some(side => lineOf(cs, side) > 0);

const plainBox = (cs: CSSStyleDeclaration): boolean =>
  unset(cs.backgroundImage, "none") &&
  unset(cs.boxShadow, "none") &&
  borderOf(cs).plain;

const warped = (cs: CSSStyleDeclaration): boolean =>
  !unset(cs.transform, "none") ||
  !unset(cs.filter, "none") ||
  !unset(cs.mixBlendMode, "normal") ||
  !unset(cs.clipPath, "none") ||
  !unset(cs.clip, "auto") ||
  !unset(cs.maskImage, "none");

const generated = (el: HTMLElement): boolean => {
  for (const pseudo of ["::before", "::after"]) {
    const content = getComputedStyle(el, pseudo).content;
    if (content && content !== "none" && content !== "normal") return true;
  }
  return false;
};

const ownText = (el: HTMLElement): boolean => {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && /\S/.test(node.textContent ?? "")) {
      return true;
    }
  }
  return false;
};

const fancyText = (el: HTMLElement, cs: CSSStyleDeclaration): boolean =>
  !unset(cs.textShadow, "none") ||
  !(unset(cs.textDecorationLine, "none") ||
    cs.textDecorationLine.startsWith("none")) ||
  !unset(cs.writingMode, "horizontal-tb") ||
  cs.display === "list-item" ||
  (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth) ||
  generated(el);

const cornersOf = (cs: CSSStyleDeclaration): Corners => [
  px(cs.borderTopLeftRadius),
  px(cs.borderTopRightRadius),
  px(cs.borderBottomRightRadius),
  px(cs.borderBottomLeftRadius),
];

const roundedPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  corners: Corners,
  inset = 0,
): void => {
  const limit = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = corners.map(r =>
    Math.max(0, Math.min(r - inset, limit)),
  ) as Corners;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x, y + h, br);
  ctx.arcTo(x, y + h, x, y, bl);
  ctx.arcTo(x, y, x + w, y, tl);
  ctx.closePath();
};

const drawBox = (
  ctx: CanvasRenderingContext2D,
  cs: CSSStyleDeclaration,
  rect: DOMRect,
  origin: Origin,
): void => {
  const x = origin.sx(rect.left);
  const y = origin.sy(rect.top);
  const width = origin.sx(rect.right) - x;
  const height = origin.sy(rect.bottom) - y;
  const corners = cornersOf(cs);
  if (isPaintedColor(cs.backgroundColor)) {
    roundedPath(ctx, x, y, width, height, corners);
    ctx.fillStyle = cs.backgroundColor;
    ctx.fill();
  }
  const border = borderOf(cs);
  if (border.width > 0) {
    const half = border.width / 2;
    roundedPath(
      ctx,
      x + half,
      y + half,
      width - border.width,
      height - border.width,
      corners,
      half,
    );
    ctx.strokeStyle = border.color;
    ctx.lineWidth = border.width;
    ctx.stroke();
  }
};

const drawPicture = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cs: CSSStyleDeclaration,
  rect: DOMRect,
  origin: Origin,
): boolean => {
  if (!img.complete || img.naturalWidth === 0) return false;
  const fit = cs.objectFit || "fill";
  if (fit !== "fill" && fit !== "cover" && fit !== "contain") return false;
  if (fit !== "fill" && !unset(cs.objectPosition, "50% 50%")) return false;
  if (paintsBox(cs) || px(cs.paddingTop) || px(cs.paddingLeft)) return false;

  const x = origin.sx(rect.left);
  const y = origin.sy(rect.top);
  const width = origin.sx(rect.right) - x;
  const height = origin.sy(rect.bottom) - y;
  let w = width;
  let h = height;
  if (fit !== "fill") {
    const scale =
      fit === "cover"
        ? Math.max(width / img.naturalWidth, height / img.naturalHeight)
        : Math.min(width / img.naturalWidth, height / img.naturalHeight);
    w = img.naturalWidth * scale;
    h = img.naturalHeight * scale;
  }
  ctx.save();
  roundedPath(ctx, x, y, width, height, cornersOf(cs));
  ctx.clip();
  try {
    ctx.drawImage(img, x + (width - w) / 2, y + (height - h) / 2, w, h);
  } catch {
    ctx.restore();
    return false;
  }
  ctx.restore();
  return true;
};

const cased = (word: string, transform: string): string => {
  if (transform === "uppercase") return word.toUpperCase();
  if (transform === "lowercase") return word.toLowerCase();
  if (transform === "capitalize") {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return word;
};

const fontOf = (cs: CSSStyleDeclaration): string =>
  `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

const createRuler = (near: HTMLElement): Ruler => {
  const doc = near.ownerDocument;
  const known = new Map<string, number | null>();
  const range = doc.createRange();
  let host: HTMLElement | null = null;
  let sample: Text | null = null;
  let foot: HTMLElement | null = null;

  return {
    ascent: cs => {
      const key = fontOf(cs);
      const seen = known.get(key);
      if (seen !== undefined) return seen;
      if (!host) {
        host = doc.createElement("div");
        host.style.cssText =
          "all:initial;position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;white-space:nowrap";
        sample = doc.createTextNode("x");
        foot = doc.createElement("span");
        foot.style.cssText =
          "display:inline-block;width:0;height:0;vertical-align:baseline";
        host.append(sample, foot);
        (near.parentNode ?? doc.body).appendChild(host);
      }
      host.style.fontStyle = cs.fontStyle;
      host.style.fontWeight = cs.fontWeight;
      host.style.fontSize = cs.fontSize;
      host.style.fontFamily = cs.fontFamily;
      range.selectNodeContents(sample!);
      const box = range.getClientRects()[0];
      const rise = box ? foot!.getBoundingClientRect().bottom - box.top : 0;
      const ascent = Number.isFinite(rise) && rise > 0 ? rise : null;
      known.set(key, ascent);
      return ascent;
    },
    done: () => host?.remove(),
  };
};

type Pen = {
  ctx: CanvasRenderingContext2D;
  range: Range;
  origin: Origin;
  ascent: number | null;
  share: number;
};

const baselineOf = (pen: Pen, top: number, height: number): number =>
  pen.origin.sy(top + (pen.ascent ?? height * pen.share));

type Word = {
  text: string;
  at: number;
  left: number;
  right: number;
  top: number;
  height: number;
  broken: boolean;
};

const wordsOf = (range: Range, node: Text, transform: string): Word[] => {
  const words: Word[] = [];
  for (const match of (node.textContent ?? "").matchAll(/\S+/g)) {
    const at = match.index ?? 0;
    range.setStart(node, at);
    range.setEnd(node, at + match[0].length);
    const rects = range.getClientRects();
    const rect = rects[0];
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    const shown = cased(match[0], transform);
    words.push({
      text: shown.length === match[0].length ? shown : match[0],
      at,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      height: rect.height,
      broken: rects.length > 1,
    });
  }
  return words;
};

const SLACK = 0.05;

const drawLine = (pen: Pen, words: Word[]): void => {
  const { ctx } = pen;
  let low = -Infinity;
  let high = Infinity;
  let before = "";
  const marks: Array<[number, number]> = [];
  for (const word of words) {
    const lead = before ? ctx.measureText(before).width : 0;
    const width = ctx.measureText(word.text).width;
    marks.push([lead, word.left], [lead + width, word.right]);
    low = Math.max(low, Math.max(word.left, word.right - 1 - width) - lead);
    high = Math.min(high, Math.min(word.left + 1, word.right - width) - lead);
    before += `${word.text} `;
  }
  const first = words[0]!;
  const line = words.map(word => word.text).join(" ");
  const y = baselineOf(pen, first.top, first.height);
  if (low <= high + SLACK) {
    ctx.fillText(line, (low + high) / 2 - pen.origin.x, y);
    return;
  }

  const count = marks.length;
  const meanDrawn = marks.reduce((sum, mark) => sum + mark[0], 0) / count;
  const meanSeen = marks.reduce((sum, mark) => sum + mark[1], 0) / count;
  let spread = 0;
  let together = 0;
  for (const [drawn, seen] of marks) {
    spread += (drawn - meanDrawn) ** 2;
    together += (drawn - meanDrawn) * (seen - meanSeen);
  }
  const slope = spread > 1 ? together / spread : 1;
  const stretch = slope > 0.9 && slope < 1.1 ? slope : 1;
  ctx.save();
  ctx.translate(meanSeen - stretch * meanDrawn - pen.origin.x, y);
  ctx.scale(stretch, 1);
  ctx.fillText(line, 0, 0);
  ctx.restore();
};

const drawRun = (
  pen: Pen,
  node: Text,
  from: number,
  shown: string,
  split: boolean,
): boolean => {
  pen.range.setStart(node, from);
  pen.range.setEnd(node, from + shown.length);
  const rects = pen.range.getClientRects();
  if (rects.length === 0) return false;
  if ((split || rects.length > 1) && shown.length > 1) {
    let any = false;
    for (let i = 0; i < shown.length; i++) {
      any = drawRun(pen, node, from + i, shown.charAt(i), false) || any;
    }
    return any;
  }
  const rect = rects[0]!;
  if (rect.width <= 0 || rect.height <= 0) return false;
  pen.ctx.fillText(
    shown,
    rect.left - pen.origin.x,
    baselineOf(pen, rect.top, rect.height),
  );
  return true;
};

const drawText = (
  pass: Pass,
  el: HTMLElement,
  cs: CSSStyleDeclaration,
): boolean => {
  const { ctx, origin } = pass;
  ctx.font = fontOf(cs);
  ctx.fillStyle = cs.color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const spaced = !unset(cs.letterSpacing, "normal") && px(cs.letterSpacing) !== 0;
  const native = "letterSpacing" in ctx;
  if (native) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = spaced
      ? cs.letterSpacing
      : "0px";
  }
  const metrics = ctx.measureText("x");
  const ascent =
    metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? 0;
  const descent =
    metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 0;
  const pen: Pen = {
    ctx,
    range: document.createRange(),
    origin,
    ascent: pass.ruler.ascent(cs),
    share: ascent + descent > 0 ? ascent / (ascent + descent) : 0.8,
  };

  const loose =
    cs.textAlign === "justify" ||
    cs.direction === "rtl" ||
    px(cs.wordSpacing) !== 0 ||
    (cs.whiteSpace || "").startsWith("pre");
  const perChar = spaced && !native;

  let drawn = false;
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    let line: Word[] = [];
    const flush = (): void => {
      if (line.length) drawLine(pen, line);
      line = [];
    };
    for (const word of wordsOf(pen.range, node as Text, cs.textTransform)) {
      drawn = true;
      if (word.broken || perChar) {
        flush();
        drawRun(pen, node as Text, word.at, word.text, perChar);
        continue;
      }
      const last = line[line.length - 1];
      if (last && (loose || Math.abs(last.top - word.top) >= 1)) flush();
      line.push(word);
    }
    flush();
  }
  return drawn;
};

const clipTo = (ctx: CanvasRenderingContext2D, clip: Box, origin: Origin): void => {
  const x = origin.sx(clip.left);
  const y = origin.sy(clip.top);
  ctx.beginPath();
  ctx.rect(
    x,
    y,
    Math.max(0, origin.sx(clip.right) - x),
    Math.max(0, origin.sy(clip.bottom) - y),
  );
  ctx.clip();
};

const narrowed = (
  clip: Box | null,
  el: HTMLElement,
  cs: CSSStyleDeclaration,
  rect: DOMRect,
): Box | null => {
  if (unset(cs.overflowX, "visible") && unset(cs.overflowY, "visible")) {
    return clip;
  }
  const own: Box = {
    left: rect.left + el.clientLeft,
    top: rect.top + el.clientTop,
    right: rect.left + el.clientLeft + el.clientWidth,
    bottom: rect.top + el.clientTop + el.clientHeight,
  };
  if (!clip) return own;
  return {
    left: Math.max(clip.left, own.left),
    top: Math.max(clip.top, own.top),
    right: Math.min(clip.right, own.right),
    bottom: Math.min(clip.bottom, own.bottom),
  };
};

const paintElement = (
  pass: Pass,
  el: Element,
  alpha: number,
  clip: Box | null,
): number => {
  if (!(el instanceof HTMLElement) || STAY_TAGS.has(el.tagName)) return 0;
  if (pass.outside && el.parentElement === pass.outside) return 0;
  if (pass.skip?.(el)) return 0;

  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return 0;
  const opacity = parseFloat(cs.opacity);
  if (opacity < 0.05 || warped(cs)) return 0;

  const rect = el.getBoundingClientRect();
  const tiny = rect.width <= 1 || rect.height <= 1;
  if (tiny && !unset(cs.overflowX, "visible")) return 0;

  const { ctx, origin } = pass;
  const inside =
    !tiny &&
    rect.bottom > origin.y &&
    rect.top < origin.y + origin.height &&
    (!clip || (clip.right > clip.left && clip.bottom > clip.top));
  const see = alpha * (Number.isFinite(opacity) ? opacity : 1);

  if (el.tagName === "IMG") {
    if (!inside) return 0;
    ctx.save();
    if (clip) clipTo(ctx, clip, origin);
    ctx.globalAlpha = see;
    const drawn = drawPicture(ctx, el as HTMLImageElement, cs, rect, origin);
    ctx.restore();
    if (drawn) pass.lifted.push({ el, text: false, box: false, image: true });
    return drawn ? 1 : 0;
  }

  const boxed = paintsBox(cs);
  const worded = ownText(el);
  if (boxed && !plainBox(cs)) return 0;
  if (worded && fancyText(el, cs)) return 0;

  let painted = 0;
  if (inside && (boxed || worded)) {
    let text = false;
    ctx.save();
    if (clip) clipTo(ctx, clip, origin);
    ctx.globalAlpha = see;
    if (boxed) drawBox(ctx, cs, rect, origin);
    ctx.restore();
    if (worded) {
      const within = narrowed(clip, el, cs, rect);
      ctx.save();
      if (within) clipTo(ctx, within, origin);
      ctx.globalAlpha = see;
      text = drawText(pass, el, cs);
      ctx.restore();
    }
    if (boxed || text) {
      pass.lifted.push({ el, text, box: boxed, image: false });
      painted++;
    }
  }

  const within = narrowed(clip, el, cs, rect);
  for (const child of Array.from(el.children)) {
    painted += paintElement(pass, child, see, within);
  }
  return painted;
};

const paintChildren = (pass: Pass, root: HTMLElement): number => {
  let painted = 0;
  for (const child of Array.from(root.children)) {
    painted += paintElement(pass, child, 1, null);
  }
  return painted;
};

type Grid = { x: number; y: number; w: number; h: number; scale: number };

const gridOf = (
  left: number,
  top: number,
  width: number,
  height: number,
  scale: number,
): Grid => {
  const x = Math.floor(left * scale);
  const y = Math.floor(top * scale);
  return {
    x,
    y,
    w: Math.ceil((left + width) * scale) - x,
    h: Math.ceil((top + height) * scale) - y,
    scale,
  };
};

const originOf = (grid: Grid, anchor: Anchor): Origin => {
  const { scale } = grid;
  const { screen } = anchor;
  return {
    x: anchor.x + grid.x / scale,
    y: anchor.y + grid.y / scale,
    height: grid.h / scale,
    sx: snapTo({ start: anchor.x, first: grid.x, scale, screen }),
    sy: snapTo({ start: anchor.y, first: grid.y, scale, screen }),
  };
};

const createLayer = (grid: Grid): Layer | null => {
  if (grid.w < 2 || grid.h < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = grid.w;
  canvas.height = grid.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(grid.scale, grid.scale);
  return { canvas, ctx };
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
  lifted: Lifted[],
  ruler: Ruler,
  anchor: Anchor,
): ScrollCapture | null => {
  const box = scroller.getBoundingClientRect();
  const width = scroller.clientWidth;
  const view = scroller.clientHeight;
  if (width < 1 || view < 1) return null;
  const top = scroller.scrollTop;
  const above = Math.max(0, Math.min(requestedAbove, top));
  const height = view + above;
  const left = box.left + scroller.clientLeft;
  const upper = box.top + scroller.clientTop - above;
  const grid = gridOf(
    left - anchor.x,
    upper - anchor.y,
    width,
    height,
    scaleFor(gl, width, height, dpr),
  );
  const layer = createLayer(grid);
  if (!layer) return null;

  const origin = originOf(grid, anchor);
  const drawn: Lifted[] = [];
  const pass: Pass = { ctx: layer.ctx, origin, lifted: drawn, ruler, skip };
  if (!paintChildren(pass, scroller)) return null;
  const texture = upload(gl, layer.canvas);
  if (!texture) return null;
  lifted.push(...drawn);
  return {
    texture,
    top,
    above,
    box: {
      x: origin.x - left,
      y: origin.y - upper,
      w: grid.w / grid.scale,
      h: grid.h / grid.scale,
    },
  };
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

  const hiddenNodes: Lifted[] = [];
  const ruler = createRuler(root);
  let texture: WebGLTexture | null = null;
  const anchor: Anchor = {
    x: rootRect.left,
    y: rootRect.top,
    screen: snapsToScreen(),
  };
  const grid = gridOf(
    0,
    0,
    rootRect.width,
    rootRect.height,
    scaleFor(gl, rootRect.width, rootRect.height, dpr),
  );
  const layer = createLayer(grid);
  if (layer) {
    const drawn: Lifted[] = [];
    const pass: Pass = {
      ctx: layer.ctx,
      origin: originOf(grid, anchor),
      lifted: drawn,
      ruler,
      skip,
      outside: scroller,
    };
    if (paintChildren(pass, root)) {
      texture = upload(gl, layer.canvas);
      if (texture) hiddenNodes.push(...drawn);
    }
  }

  const scroll = scroller
    ? captureScroll(
        gl,
        scroller,
        dpr,
        options.above ?? 0,
        skip,
        hiddenNodes,
        ruler,
        anchor,
      )
    : null;
  ruler.done();

  if (!texture && !scroll) return null;
  return {
    texture,
    box: {
      x: grid.x / grid.scale,
      y: grid.y / grid.scale,
      w: grid.w / grid.scale,
      h: grid.h / grid.scale,
    },
    hiddenNodes,
    scroll,
  };
};

export const hideCapturedText = (nodes: Lifted[]): (() => void) => {
  const taken = new Set(nodes.filter(n => n.text).map(n => n.el));
  const pins: Array<{ el: HTMLElement; color: string; keep: string }> = [];
  for (const el of taken) {
    for (const child of Array.from(el.children)) {
      if (!(child instanceof HTMLElement) && !(child instanceof SVGElement)) {
        continue;
      }
      if (taken.has(child as HTMLElement)) continue;
      pins.push({
        el: child as HTMLElement,
        color: (child as HTMLElement).style.color,
        keep: getComputedStyle(child).color,
      });
    }
  }

  const restore = nodes.map(node => ({
    node,
    color: node.el.style.color,
    backgroundColor: node.el.style.backgroundColor,
    borderColor: node.el.style.borderColor,
    opacity: node.el.style.opacity,
  }));
  for (const { node } of restore) {
    const style = node.el.style;
    if (node.image) style.opacity = "0";
    if (node.text) style.color = "transparent";
    if (node.box) {
      style.backgroundColor = "transparent";
      style.borderColor = "transparent";
    }
  }
  for (const pin of pins) pin.el.style.color = pin.keep;

  return () => {
    for (const pin of pins) pin.el.style.color = pin.color;
    for (const entry of restore) {
      const style = entry.node.el.style;
      style.color = entry.color;
      style.backgroundColor = entry.backgroundColor;
      style.borderColor = entry.borderColor;
      style.opacity = entry.opacity;
    }
  };
};
