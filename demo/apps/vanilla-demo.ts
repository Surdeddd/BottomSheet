import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import {
  allowedFromSnaps,
  buildItem,
  buildShell,
  demoRows,
  snapPoints,
  type DemoController,
  type DemoSettings,
} from "./shared";

export const mountVanillaDemo = (
  host: HTMLElement,
  settings: DemoSettings,
): DemoController => {
  const shell = buildShell(host, "Issue 07 · Vanilla");

  const root = document.createElement("div");
  root.className = "bs-root";

  const backdrop = document.createElement("div");
  backdrop.className = "bs-backdrop";

  const sheet = document.createElement("section");
  sheet.className = "bs-sheet";
  sheet.dataset.mode = settings.mode;
  sheet.setAttribute("role", "dialog");

  const handle = document.createElement("div");
  handle.className = "bs-handle";
  handle.setAttribute("role", "slider");
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("aria-label", "Resize sheet");

  const header = document.createElement("div");
  header.className = "sheet-header";
  const h2 = document.createElement("h2");
  h2.textContent = "Active routes";
  const hint = document.createElement("span");
  hint.className = "hint";
  hint.textContent = "VANILLA · ENGINE";
  header.append(h2, hint);
  handle.append(header);

  const content = document.createElement("div");
  content.className = "bs-content";
  content.setAttribute("tabindex", "0");
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", "Sheet content");
  for (const [title, sub] of demoRows) content.append(buildItem(title, sub));

  sheet.append(handle, content);
  root.append(backdrop, sheet);
  shell.append(root);

  const engine = new BottomSheetEngine({
    element: sheet,
    handle,
    scrollContainer: content,
    backdrop,
    mode: settings.mode as "bottom" | "top" | "left" | "right",
    snapPoints: snapPoints(settings.mode),
    allowed: allowedFromSnaps(settings.mode),
    initial: settings.initial,
    animation: "spring",
    spring: { stiffness: settings.stiffness, damping: settings.damping },
    focusTrap: settings.focusTrap,
    closeOnEscape: settings.closeOnEscape,
    rubberBand: settings.rubberBand,
    backdropRange: [0.4, 1],
    lockBodyScroll: false,
  });

  backdrop.addEventListener("click", () => void engine.close());

  let updateCb: ((s: any) => void) | null = null;
  let velocityCb: ((v: number) => void) | null = null;
  let interval: number | null = null;
  let lastSize = 0;
  let lastTs = performance.now();

  interval = window.setInterval(() => {
    const state = engine.state;
    updateCb?.(state);
    const now = performance.now();
    const dt = now - lastTs;
    if (dt > 0) velocityCb?.((state.size - lastSize) / dt);
    lastSize = state.size;
    lastTs = now;
  }, 33);

  return {
    getEngine: () => engine,
    destroy: () => {
      if (interval) clearInterval(interval);
      engine.destroy();
      root.remove();
    },
    snapTo: (id: string) => {
      void engine.snapTo(id);
    },
    onUpdate: (fn: (s: any) => void) => {
      updateCb = fn;
    },
    onVelocity: (fn: (v: number) => void) => {
      velocityCb = fn;
    },
  };
};
