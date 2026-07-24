import { animate, inView } from "motion";

/**
 * Each feature card can carry a small diagram of the thing it describes,
 * drawn as inline SVG and played on entry and on hover. Only cards that have
 * something worth drawing get one — the rest stay clean type.
 */

export type VizKind = "spring" | "frames" | "ladder" | "compass" | "stack" | "keys";

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

/** Damped oscillation — the settle curve the engine actually produces. */
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
    // sits above the spec line, below the body copy
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
