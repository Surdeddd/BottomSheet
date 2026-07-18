import type { EngineState, SheetEventMap } from "../core/types";

export type DebugOverlayPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type DebugOverlayOptions = {
  position?: DebugOverlayPosition;
  compact?: boolean;
};

export type DebuggableEngine = {
  state: EngineState & { activeId: string };
  on<K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ): () => void;
  getResolvedSnaps(): readonly { id: string; size: number }[];
  isTop(): boolean;
};

const PANEL_GAP = 8;
const PANEL_WIDTH = 232;

let panelCount = 0;

const anchorStyles = (
  position: DebugOverlayPosition,
  offset: number,
): Partial<CSSStyleDeclaration> => {
  const main = `${PANEL_GAP + offset}px`;
  const cross = `${PANEL_GAP}px`;
  switch (position) {
    case "top-left":
      return { top: main, left: cross };
    case "bottom-left":
      return { bottom: main, left: cross };
    case "bottom-right":
      return { bottom: main, right: cross };
    default:
      return { top: main, right: cross };
  }
};

export function attachDebugOverlay(
  engine: DebuggableEngine,
  opts: DebugOverlayOptions = {},
): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }

  const index = panelCount;
  panelCount += 1;
  const position = opts.position ?? "top-right";
  const compact = opts.compact ?? false;

  const panel = document.createElement("div");
  panel.setAttribute("data-bs-debug", "");
  Object.assign(panel.style, {
    position: "fixed",
    zIndex: "2147483647",
    width: `${PANEL_WIDTH}px`,
    padding: "8px 10px",
    borderRadius: "8px",
    background: "rgba(12, 12, 16, 0.88)",
    color: "#9fef9f",
    font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
    pointerEvents: "auto",
    whiteSpace: "pre",
    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
  } satisfies Partial<CSSStyleDeclaration>);
  Object.assign(panel.style, anchorStyles(position, index * 132));

  const header = document.createElement("div");
  header.style.color = "#fff";
  header.style.fontWeight = "700";
  header.textContent = `bs-debug #${index + 1}`;
  const live = document.createElement("div");
  const snapList = document.createElement("div");
  snapList.style.color = "#8ab8ff";
  panel.append(header, live);
  if (!compact) panel.append(snapList);
  document.body.appendChild(panel);

  let rafId: number | null = null;
  let destroyed = false;

  const renderLive = (): void => {
    const s = engine.state;
    live.textContent =
      `active  ${s.activeId}\n` +
      `size    ${s.size.toFixed(1)}px\n` +
      `progress ${s.progress.toFixed(2)}\n` +
      `flags   ${s.isDragging ? "drag " : ""}${s.isAnimating ? "anim " : ""}${engine.isTop() ? "top" : ""}`;
  };

  const renderSnaps = (): void => {
    if (compact) return;
    const active = engine.state.activeId;
    snapList.textContent = engine
      .getResolvedSnaps()
      .map(p => `${p.id === active ? "▸" : " "} ${p.id}: ${Math.round(p.size)}px`)
      .join("\n");
  };

  const scheduleLive = (): void => {
    if (destroyed || rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (destroyed) return;
      renderLive();
    });
  };

  const renderAll = (): void => {
    if (destroyed) return;
    renderLive();
    renderSnaps();
  };

  const subs = [
    engine.on("progress", scheduleLive),
    engine.on("drag", scheduleLive),
    engine.on("dragstart", renderAll),
    engine.on("dragend", renderAll),
    engine.on("snap", renderAll),
    engine.on("open", renderAll),
    engine.on("close", renderAll),
    engine.on("opened", renderAll),
    engine.on("closed", renderAll),
  ];

  renderAll();

  return () => {
    if (destroyed) return;
    destroyed = true;
    for (const off of subs) off();
    if (rafId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(rafId);
    }
    panel.remove();
    panelCount = Math.max(0, panelCount - 1);
  };
}
