import type { BottomSheetEngine } from "@surdeddd/bottom-sheet";

export type FloatingUiOptions = {
  getEngine: () => BottomSheetEngine | null;
};

export const whenEngineReady = (
  getEngine: () => BottomSheetEngine | null,
  cb: (engine: BottomSheetEngine) => void,
  tries = 60,
): void => {
  const engine = getEngine();
  if (engine) {
    cb(engine);
    return;
  }
  if (tries <= 0) return;
  requestAnimationFrame(() => whenEngineReady(getEngine, cb, tries - 1));
};

export const wireFloatingUi = (
  opts: FloatingUiOptions,
): { syncToEngine: () => void } => {
  const anchorToggle = document.getElementById(
    "tg-anchor-btn",
  ) as HTMLInputElement | null;
  const stagesToggle = document.getElementById(
    "tg-scrim-stages",
  ) as HTMLInputElement | null;
  const dockToggle = document.getElementById(
    "tg-dock-bar",
  ) as HTMLInputElement | null;
  if (!anchorToggle && !stagesToggle && !dockToggle) {
    return { syncToEngine: () => {} };
  }

  let detachAnchor: (() => void) | null = null;
  let detachStages: (() => void) | null = null;
  let detachDock: (() => void) | null = null;

  const buildAnchor = (engine: BottomSheetEngine): (() => void) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "demo-anchor-btn";
    btn.textContent = "✕ close";
    btn.addEventListener("click", () => void opts.getEngine()?.close());
    return engine.addAnchor({
      element: btn,
      position: "sheet-top-right",
      inset: "14px",
      showOn: state => state.size > 0,
      animation: "pop",
      interactive: true,
    });
  };

  const buildStages = (engine: BottomSheetEngine): (() => void) => {
    const teaser = document.createElement("div");
    teaser.className = "demo-stage-badge";
    teaser.textContent = "↑ drag up for more";
    const expanded = document.createElement("div");
    expanded.className = "demo-stage-badge is-expanded";
    expanded.textContent = "★ expanded view";
    return engine.setScrimStages({
      position: "top-center",
      inset: "18px",
      animation: "scale",
      stages: [
        { forRange: [0, 0.55], element: teaser },
        { forRange: [0.55, 1], element: expanded },
      ],
    });
  };

  const buildDock = (engine: BottomSheetEngine): (() => void) => {
    const bar = document.createElement("nav");
    bar.className = "demo-dock-bar";
    ["01", "02", "03", "04"].forEach((label, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = i === 1 ? "demo-dock-item is-active" : "demo-dock-item";
      const dot = document.createElement("span");
      dot.className = "demo-dock-dot";
      const text = document.createElement("span");
      text.textContent = label;
      item.append(dot, text);
      item.addEventListener("click", () => {
        bar.querySelectorAll(".demo-dock-item").forEach(x =>
          x.classList.toggle("is-active", x === item),
        );
      });
      bar.appendChild(item);
    });
    return engine.addAnchor({
      element: bar,
      position: "dock-bottom",
      animation: "slide",
      interactive: true,
    });
  };

  const apply = (): void => {
    detachAnchor?.();
    detachAnchor = null;
    detachStages?.();
    detachStages = null;
    detachDock?.();
    detachDock = null;
    if (!anchorToggle?.checked && !stagesToggle?.checked && !dockToggle?.checked) {
      return;
    }
    whenEngineReady(opts.getEngine, engine => {
      if (anchorToggle?.checked && !detachAnchor) {
        detachAnchor = buildAnchor(engine);
      }
      if (stagesToggle?.checked && !detachStages) {
        detachStages = buildStages(engine);
      }
      if (dockToggle?.checked && !detachDock) {
        detachDock = buildDock(engine);
      }
    });
  };

  anchorToggle?.addEventListener("change", apply);
  stagesToggle?.addEventListener("change", apply);
  dockToggle?.addEventListener("change", apply);

  return {
    syncToEngine: () => {
      detachAnchor = null;
      detachStages = null;
      detachDock = null;
      apply();
    },
  };
};
