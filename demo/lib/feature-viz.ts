import { animate, inView } from "motion";

export type VizKind =
  | "spring"
  | "frames"
  | "ladder"
  | "compass"
  | "stack"
  | "keys"
  | "pointers"
  | "safearea"
  | "layers"
  | "hydrate"
  | "registry"
  | "grid"
  | "zones"
  | "anchors"
  | "modules"
  | "probe";

const NS = "http://www.w3.org/2000/svg";
const W = 200;
const H = 44;

const reduced = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const el = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

const springPath = (): string => {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const x = t * W;
    const decay = Math.exp(-4.2 * t);
    const y = H / 2 - Math.sin(t * Math.PI * 3.2) * decay * (H / 2 - 4);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
};

const build = (kind: VizKind): SVGSVGElement => {
  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: H,
    fill: "none",
    "aria-hidden": "true",
    focusable: "false",
  });

  const stroke = "var(--vermillion)";
  const faint = "var(--hairline-strong)";

  if (kind === "spring") {
    svg.append(
      el("line", { x1: 0, y1: H / 2, x2: W, y2: H / 2, stroke: faint, "stroke-width": 1 }),
      el("path", {
        d: springPath(),
        stroke,
        "stroke-width": 1.6,
        "stroke-linecap": "round",
        "data-draw": "1",
      }),
    );
  }

  if (kind === "frames") {
    for (let i = 0; i < 16; i++) {
      svg.append(
        el("rect", {
          x: i * 12.5,
          y: H / 2 - 9,
          width: 7,
          height: 18,
          rx: 1.5,
          fill: i % 4 === 0 ? stroke : faint,
          opacity: i % 4 === 0 ? 0.9 : 0.5,
          "data-bar": i,
        }),
      );
    }
  }

  if (kind === "ladder") {
    const levels = [0.22, 0.55, 0.9];
    levels.forEach((lv, i) => {
      const y = H - lv * (H - 6) - 3;
      svg.append(
        el("line", {
          x1: 0,
          y1: y,
          x2: W,
          y2: y,
          stroke: i === 1 ? stroke : faint,
          "stroke-width": 1,
          "stroke-dasharray": "3 5",
          "data-rung": i,
        }),
      );
    });
    svg.append(
      el("rect", {
        x: W / 2 - 26,
        y: H - 0.55 * (H - 6) - 6,
        width: 52,
        height: 6,
        rx: 3,
        fill: stroke,
        "data-sheet": "1",
      }),
    );
  }

  if (kind === "compass") {
    const cx = W / 2;
    const cy = H / 2;
    svg.append(el("rect", { x: cx - 16, y: cy - 12, width: 32, height: 24, rx: 3, stroke: faint, "stroke-width": 1 }));
    const arrows: [number, number, number, number][] = [
      [cx, cy - 16, cx, cy - 20],
      [cx, cy + 16, cx, cy + 20],
      [cx - 22, cy, cx - 28, cy],
      [cx + 22, cy, cx + 28, cy],
    ];
    arrows.forEach((a, i) =>
      svg.append(
        el("line", {
          x1: a[0], y1: a[1], x2: a[2], y2: a[3],
          stroke, "stroke-width": 2, "stroke-linecap": "round",
          "data-arrow": i,
        }),
      ),
    );
  }

  if (kind === "stack") {
    for (let i = 0; i < 4; i++) {
      svg.append(
        el("rect", {
          x: 30 + i * 8,
          y: H - 12 - i * 7,
          width: 110,
          height: 10,
          rx: 3,
          fill: i === 3 ? stroke : faint,
          opacity: i === 3 ? 0.9 : 0.45,
          "data-layer": i,
        }),
      );
    }
  }

  if (kind === "keys") {
    const labels = ["↑", "↓", "Esc", "Tab"];
    labels.forEach((label, i) => {
      const x = 6 + i * 48;
      svg.append(
        el("rect", { x, y: H / 2 - 11, width: 40, height: 22, rx: 4, stroke: faint, "stroke-width": 1, "data-key": i }),
      );
      const text = el("text", {
        x: x + 20,
        y: H / 2 + 4,
        "text-anchor": "middle",
        "font-size": 10,
        fill: stroke,
        "font-family": "var(--mono)",
      });
      text.textContent = label;
      svg.append(text);
    });
  }

  if (kind === "pointers") {

    const midY = H / 2;
    svg.append(el("circle", { cx: 34, cy: midY, r: 9, fill: stroke, opacity: 0.85, "data-touch": "1" }));
    for (let i = 0; i < 4; i++) {
      svg.append(
        el("circle", { cx: 34 - 14 - i * 11, cy: midY, r: 2.4 - i * 0.4, fill: stroke, opacity: 0.4 - i * 0.08 }),
      );
    }
    svg.append(
      el("path", { d: `M126 ${midY - 9} L126 ${midY + 7} L131 ${midY + 2} L136 ${midY + 9} L139 ${midY + 6} L134 ${midY} L140 ${midY - 1} Z`, fill: faint, stroke: faint, "stroke-width": 1, "data-mouse": "1" }),
    );
    for (let i = 0; i < 3; i++) {
      svg.append(el("line", { x1: 150 + i * 14, y1: midY, x2: 158 + i * 14, y2: midY, stroke: faint, "stroke-width": 1.5, opacity: 0.5 - i * 0.12 }));
    }
  }

  if (kind === "safearea") {
    svg.append(el("rect", { x: 52, y: 3, width: 96, height: H - 6, rx: 10, stroke: faint, "stroke-width": 1 }));

    svg.append(
      el("rect", { x: 58, y: 9, width: 84, height: H - 18, rx: 6, stroke, "stroke-width": 1, "stroke-dasharray": "3 4", "data-safe": "1" }),
    );
    svg.append(el("rect", { x: 86, y: 3, width: 28, height: 5, rx: 2.5, fill: faint }));
    svg.append(el("rect", { x: 82, y: H - 10, width: 36, height: 3, rx: 1.5, fill: stroke, opacity: 0.8 }));
  }

  if (kind === "layers") {

    svg.append(el("rect", { x: 8, y: H / 2 - 8, width: 54, height: 16, rx: 3, fill: stroke, opacity: 0.85, "data-core": "1" }));
    svg.append(el("line", { x1: 62, y1: H / 2, x2: 84, y2: H / 2 - 12, stroke: faint, "stroke-width": 1 }));
    svg.append(el("line", { x1: 62, y1: H / 2, x2: 84, y2: H / 2 + 12, stroke: faint, "stroke-width": 1 }));
    svg.append(el("rect", { x: 86, y: H / 2 - 20, width: 62, height: 15, rx: 3, stroke: faint, "stroke-width": 1, "data-branch": "0" }));
    svg.append(el("rect", { x: 86, y: H / 2 + 5, width: 96, height: 15, rx: 3, stroke: faint, "stroke-width": 1, "data-branch": "1" }));
  }

  if (kind === "hydrate") {

    svg.append(el("rect", { x: 6, y: H / 2 - 13, width: 52, height: 26, rx: 3, stroke: faint, "stroke-width": 1 }));
    svg.append(el("rect", { x: 142, y: H / 2 - 13, width: 52, height: 26, rx: 3, stroke: faint, "stroke-width": 1 }));
    svg.append(el("line", { x1: 58, y1: H / 2, x2: 142, y2: H / 2, stroke: faint, "stroke-width": 1, "stroke-dasharray": "4 4" }));
    for (let i = 0; i < 3; i++) {
      svg.append(el("circle", { cx: 74 + i * 26, cy: H / 2, r: 3, fill: stroke, opacity: 0.9, "data-packet": i }));
    }
  }

  if (kind === "registry") {

    const cx = 30;
    const cy = H / 2;
    svg.append(el("circle", { cx, cy, r: 7, fill: stroke, opacity: 0.9 }));
    for (let i = 0; i < 4; i++) {
      const y = 7 + i * ((H - 14) / 3);
      svg.append(el("line", { x1: cx + 8, y1: cy, x2: 96, y2: y, stroke: faint, "stroke-width": 1, "data-edge": i }));
      svg.append(el("rect", { x: 100, y: y - 5, width: 74, height: 10, rx: 2, fill: faint, opacity: 0.55, "data-leaf": i }));
    }
  }

  if (kind === "zones") {

    svg.append(el("rect", { x: 22, y: 4, width: 156, height: H - 8, rx: 4, stroke: faint, "stroke-width": 1 }));
    svg.append(el("rect", { x: 76, y: 8, width: 48, height: 5, rx: 2.5, fill: stroke, "data-zhandle": "1" }));
    svg.append(el("rect", { x: 28, y: 19, width: 66, height: H - 27, rx: 3, fill: stroke, opacity: 0.22, "data-zone": "yes" }));
    svg.append(el("rect", { x: 104, y: 19, width: 68, height: H - 27, rx: 3, fill: faint, opacity: 0.3, "data-zone": "no" }));
    svg.append(el("path", { d: `M132 ${H / 2 - 4} l12 12 M144 ${H / 2 - 4} l-12 12`, stroke: faint, "stroke-width": 1.4, "stroke-linecap": "round" }));
  }

  if (kind === "anchors") {

    svg.append(el("rect", { x: 30, y: H - 16, width: 140, height: 12, rx: 3, fill: faint, opacity: 0.5 }));
    svg.append(el("line", { x1: 30, y1: H - 18, x2: 170, y2: H - 18, stroke, "stroke-width": 1, "stroke-dasharray": "3 3", "data-anchor-edge": "1" }));
    svg.append(el("rect", { x: 138, y: H - 30, width: 30, height: 12, rx: 6, fill: stroke, opacity: 0.9, "data-fab": "1" }));
    svg.append(el("rect", { x: 30, y: 6, width: 140, height: 14, rx: 3, fill: faint, opacity: 0.25 }));
  }

  if (kind === "modules") {

    svg.append(el("rect", { x: 8, y: H / 2 - 12, width: 58, height: 24, rx: 3, fill: stroke, opacity: 0.85, "data-mcore": "1" }));
    for (let i = 0; i < 4; i++) {
      svg.append(
        el("rect", {
          x: 74 + i * 32, y: H / 2 - 9, width: 26, height: 18, rx: 3,
          stroke: faint, "stroke-width": 1, "stroke-dasharray": "3 3",
          "data-mod": i,
        }),
      );
    }
  }

  if (kind === "probe") {

    svg.append(el("rect", { x: 6, y: 4, width: 188, height: H - 8, rx: 3, stroke: faint, "stroke-width": 1 }));
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = 12 + (i / 40) * 176;
      const y = H / 2 + Math.sin(i / 3.1) * (H / 5) * (1 - i / 60);
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    svg.append(el("path", { d: pts.join(" "), stroke, "stroke-width": 1.5, "data-trace": "1", "stroke-linecap": "round" }));
    for (let i = 0; i < 3; i++) {
      svg.append(el("rect", { x: 12 + i * 20, y: H - 12, width: 14, height: 4, rx: 2, fill: faint, opacity: 0.6 }));
    }
  }

  if (kind === "grid") {

    const cols = 20;
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        svg.append(
          el("rect", {
            x: c * 10, y: 4 + r * 13, width: 7, height: 9, rx: 1.5,
            fill: (r * cols + c) % 7 === 0 ? stroke : faint,
            opacity: (r * cols + c) % 7 === 0 ? 0.9 : 0.4,
            "data-cell": r * cols + c,
          }),
        );
      }
    }
  }

  return svg;
};

const play = (svg: SVGSVGElement, kind: VizKind): void => {
  if (kind === "spring") {
    const path = svg.querySelector<SVGPathElement>("[data-draw]");
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    animate(
      path,
      { strokeDashoffset: [len, 0] },
      { duration: 1.1, ease: [0.2, 0.8, 0.3, 1] },
    );
  }
  if (kind === "frames") {
    const bars = Array.from(svg.querySelectorAll<SVGRectElement>("[data-bar]"));
    animate(
      bars,
      { opacity: [0.2, 0.9], scaleY: [0.55, 1] },
      { duration: 0.5, delay: (i: number) => i * 0.028, ease: "easeOut" },
    );
  }
  if (kind === "ladder") {
    const sheet = svg.querySelector<SVGRectElement>("[data-sheet]");
    if (sheet) {
      animate(sheet, { y: [H - 6, H - 0.55 * (H - 6) - 6] }, { type: "spring", stiffness: 170, damping: 16 });
    }
  }
  if (kind === "compass") {
    const arrows = Array.from(svg.querySelectorAll<SVGLineElement>("[data-arrow]"));
    animate(arrows, { opacity: [0.15, 1] }, { duration: 0.4, delay: (i: number) => i * 0.09 });
  }
  if (kind === "stack") {
    const layers = Array.from(svg.querySelectorAll<SVGRectElement>("[data-layer]"));
    animate(
      layers,
      { x: [18, 0], opacity: [0, 1] },
      { duration: 0.5, delay: (i: number) => i * 0.07, ease: [0.2, 0.8, 0.3, 1] },
    );
  }
  if (kind === "keys") {
    const keys = Array.from(svg.querySelectorAll<SVGRectElement>("[data-key]"));
    animate(keys, { opacity: [0.25, 1] }, { duration: 0.35, delay: (i: number) => i * 0.08 });
  }
  if (kind === "pointers") {
    const touch = svg.querySelector<SVGCircleElement>("[data-touch]");
    const mouse = svg.querySelector<SVGPathElement>("[data-mouse]");
    if (touch) animate(touch, { x: [-26, 0], opacity: [0.3, 0.85] }, { type: "spring", stiffness: 190, damping: 18 });
    if (mouse) animate(mouse, { x: [22, 0], opacity: [0.2, 1] }, { duration: 0.5, ease: "easeOut" });
  }
  if (kind === "safearea") {
    const safe = svg.querySelector<SVGRectElement>("[data-safe]");
    if (safe) animate(safe, { opacity: [0, 1], scale: [0.94, 1] }, { duration: 0.55, ease: [0.2, 0.8, 0.3, 1] });
  }
  if (kind === "layers") {
    const core = svg.querySelector<SVGRectElement>("[data-core]");
    const branches = Array.from(svg.querySelectorAll<SVGRectElement>("[data-branch]"));
    if (core) animate(core, { scaleX: [0.5, 1], opacity: [0.4, 0.85] }, { duration: 0.45, ease: "easeOut" });
    animate(branches, { x: [-14, 0], opacity: [0, 1] }, { duration: 0.45, delay: (i: number) => 0.18 + i * 0.1, ease: [0.2, 0.8, 0.3, 1] });
  }
  if (kind === "hydrate") {
    const packets = Array.from(svg.querySelectorAll<SVGCircleElement>("[data-packet]"));
    animate(packets, { x: [-56, 0], opacity: [0, 0.9] }, { duration: 0.75, delay: (i: number) => i * 0.13, ease: "easeInOut" });
  }
  if (kind === "registry") {
    const edges = Array.from(svg.querySelectorAll<SVGLineElement>("[data-edge]"));
    const leaves = Array.from(svg.querySelectorAll<SVGRectElement>("[data-leaf]"));
    animate(edges, { opacity: [0, 1] }, { duration: 0.3, delay: (i: number) => i * 0.07 });
    animate(leaves, { x: [-12, 0], opacity: [0, 0.55] }, { duration: 0.4, delay: (i: number) => 0.1 + i * 0.07 });
  }
  if (kind === "zones") {
    const yes = svg.querySelector<SVGRectElement>('[data-zone="yes"]');
    const no = svg.querySelector<SVGRectElement>('[data-zone="no"]');
    const h = svg.querySelector<SVGRectElement>("[data-zhandle]");
    if (h) animate(h, { scaleX: [0.4, 1] }, { type: "spring", stiffness: 200, damping: 16 });
    if (yes) animate(yes, { opacity: [0, 0.22] }, { duration: 0.4 });
    if (no) animate(no, { opacity: [0, 0.3] }, { duration: 0.4, delay: 0.12 });
  }
  if (kind === "anchors") {
    const fab = svg.querySelector<SVGRectElement>("[data-fab]");
    const edge = svg.querySelector<SVGLineElement>("[data-anchor-edge]");
    if (edge) animate(edge, { opacity: [0, 1] }, { duration: 0.35 });
    if (fab) animate(fab, { y: [16, 0], opacity: [0, 0.9] }, { type: "spring", stiffness: 180, damping: 15 });
  }
  if (kind === "modules") {
    const core = svg.querySelector<SVGRectElement>("[data-mcore]");
    const mods = Array.from(svg.querySelectorAll<SVGRectElement>("[data-mod]"));
    if (core) animate(core, { scaleX: [0.55, 1] }, { duration: 0.4, ease: "easeOut" });
    animate(mods, { x: [18, 0], opacity: [0, 1] }, { duration: 0.42, delay: (i: number) => 0.14 + i * 0.08, ease: [0.2, 0.8, 0.3, 1] });
  }
  if (kind === "probe") {
    const trace = svg.querySelector<SVGPathElement>("[data-trace]");
    if (trace) {
      const len = trace.getTotalLength();
      trace.style.strokeDasharray = `${len}`;
      animate(trace, { strokeDashoffset: [len, 0] }, { duration: 1, ease: "easeOut" });
    }
  }
  if (kind === "grid") {
    const cells = Array.from(svg.querySelectorAll<SVGRectElement>("[data-cell]"));
    animate(cells, { opacity: [0.08, 1], scale: [0.6, 1] }, { duration: 0.32, delay: (i: number) => i * 0.006, ease: "easeOut" });
  }
};

export const initFeatureViz = (): { destroy: () => void } => {
  const hosts = Array.from(
    document.querySelectorAll<HTMLElement>("[data-viz]"),
  );
  if (hosts.length === 0) return { destroy: () => {} };

  const cleanups: (() => void)[] = [];

  for (const host of hosts) {
    const kind = host.dataset.viz as VizKind | undefined;
    if (!kind) continue;
    const slot = document.createElement("div");
    slot.className = "feature-viz";
    const svg = build(kind);
    slot.appendChild(svg);

    const spec = host.querySelector(".feature-spec");
    host.insertBefore(slot, spec ?? null);

    if (reduced()) continue;

    const stop = inView(host, () => play(svg, kind), { amount: 0.5 });
    const onEnter = (): void => play(svg, kind);
    host.addEventListener("pointerenter", onEnter);
    cleanups.push(() => {
      stop();
      host.removeEventListener("pointerenter", onEnter);
    });
  }

  return {
    destroy: () => {
      for (const c of cleanups) c();
      for (const host of hosts) {
        host.querySelector(".feature-viz")?.remove();
      }
    },
  };
};
