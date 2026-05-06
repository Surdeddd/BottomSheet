import type { BottomSheetElement } from "@surdeddd/bottom-sheet/element";
import {
  allowedFromSnaps,
  buildItem,
  buildShell,
  demoRows,
  snapPoints,
  type DemoController,
  type DemoSettings,
} from "./shared";

export const mountElementDemo = (
  host: HTMLElement,
  settings: DemoSettings,
): DemoController => {
  const shell = buildShell(host, "Issue 06 · Web Component");

  const sheet = document.createElement("bottom-sheet") as BottomSheetElement;
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  sheet.setAttribute("mode", mode);
  sheet.setAttribute("snap-points", JSON.stringify(snapPoints(mode)));
  sheet.setAttribute("initial", settings.initial);
  sheet.setAttribute("allowed", allowedFromSnaps(settings.mode).join(","));
  sheet.setAttribute("animation", "spring");
  sheet.setAttribute("focus-trap", String(settings.focusTrap));
  sheet.setAttribute("close-on-escape", String(settings.closeOnEscape));
  sheet.setAttribute("lock-body-scroll", "false");
  sheet.setAttribute("stylesheet", "/style.css");

  const header = document.createElement("div");
  header.slot = "header";
  header.className = "sheet-header";
  const h2 = document.createElement("h2");
  h2.textContent = "Active routes";
  const hint = document.createElement("span");
  hint.className = "hint";
  hint.textContent = "WEB COMPONENT · SHADOW DOM";
  header.append(h2, hint);
  sheet.append(header);

  const list = document.createElement("div");
  list.className = "sheet-list";
  for (const [title, sub] of demoRows) list.append(buildItem(title, sub));
  sheet.append(list);

  shell.append(sheet);

  let updateCb: ((s: any) => void) | null = null;
  let velocityCb: ((v: number) => void) | null = null;
  let interval: number | null = null;
  let lastSize = 0;
  let lastTs = performance.now();

  requestAnimationFrame(() => {
    interval = window.setInterval(() => {
      const state = sheet.sheetState;
      if (!state) return;
      updateCb?.(state);
      const now = performance.now();
      const dt = now - lastTs;
      if (dt > 0) velocityCb?.((state.size - lastSize) / dt);
      lastSize = state.size;
      lastTs = now;
    }, 33);
  });

  return {
    destroy: () => {
      if (interval) clearInterval(interval);
      sheet.remove();
    },
    snapTo: (id: string) => {
      void sheet.snapTo(id);
    },
    onUpdate: (fn: (s: any) => void) => {
      updateCb = fn;
    },
    onVelocity: (fn: (v: number) => void) => {
      velocityCb = fn;
    },
  };
};
