import type { EngineState } from "@surdeddd/bottom-sheet";
import { OverlayEngine } from "@surdeddd/bottom-sheet/overlay";
import type { AdapterKey } from "../lib/types";
import { buildShell, type DemoController, type DemoSettings } from "./shared";

const KICKERS: Record<AdapterKey, string> = {
  react: "Issue 01 · React",
  vue: "Issue 02 · Vue",
  svelte: "Issue 03 · Svelte",
  solid: "Issue 04 · Solid",
  lit: "Issue 05 · Lit",
  element: "Issue 06 · Web Component",
  vanilla: "Issue 07 · Vanilla",
};

export const OVERLAY_ITEMS: Array<{ label: string; danger?: boolean }> = [
  { label: "Profile settings" },
  { label: "Notifications" },
  { label: "Sign out", danger: true },
];

export const OVERLAY_OPEN_DELAY_MS = 400;
export const OVERLAY_AUTO_CLOSE_MS = 3900;

const buildContent = (onCancel: () => void): HTMLElement => {
  const wrap = document.createElement("div");
  wrap.className = "ovl-demo";

  const title = document.createElement("h2");
  title.id = "ovl-demo-title";
  title.textContent = "Account";

  const sub = document.createElement("p");
  sub.className = "ovl-demo-sub";
  sub.textContent = "marina@studio.ru · freelance";

  const list = document.createElement("ul");
  list.className = "ovl-demo-list";
  for (const item of OVERLAY_ITEMS) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.label;
    if (item.danger) btn.className = "is-danger";
    li.append(btn);
    list.append(li);
  }

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ovl-demo-cancel";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", onCancel);

  wrap.append(title, sub, list, cancel);
  return wrap;
};

export const mountOverlayDemo = (
  host: HTMLElement,
  settings: DemoSettings,
  adapter: AdapterKey,
): DemoController => {
  const shell = buildShell(host, KICKERS[adapter]);

  const root = document.createElement("div");
  root.className = "ovl-root";
  const backdrop = document.createElement("div");
  backdrop.className = "ovl-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  const panel = document.createElement("section");
  panel.className = "ovl-panel";
  panel.dataset.edge = "bottom";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "ovl-demo-title");
  root.append(backdrop, panel);
  shell.append(root);

  let interacted = false;
  const engine = new OverlayEngine({
    element: panel,
    backdrop,
    edge: "bottom",
    duration: 320,
    focusTrap: settings.focusTrap,
    closeOnEscape: settings.closeOnEscape,
    lockBodyScroll: false,
    onClose: () => {
      interacted = true;
    },
  });
  panel.append(
    buildContent(() => {
      interacted = true;
      void engine.close();
    }),
  );

  const openTimer = window.setTimeout(
    () => void engine.open(),
    OVERLAY_OPEN_DELAY_MS,
  );
  const closeTimer = window.setTimeout(() => {
    if (!interacted) void engine.close();
  }, OVERLAY_AUTO_CLOSE_MS);

  let updateCb: ((s: EngineState) => void) | null = null;
  const interval = window.setInterval(() => {
    const { isOpen, isAnimating } = engine.state;
    updateCb?.({
      activeId: isOpen ? "open" : "closed",
      activeLabel: isOpen ? "open" : "closed",
      progress: isOpen ? 1 : 0,
      size: 0,
      isDragging: false,
      isAnimating,
      phase: isOpen ? "open" : "closed",
    });
  }, 33);

  return {
    destroy: () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      clearInterval(interval);
      engine.destroy();
      root.remove();
    },
    snapTo: (id: string) => {
      interacted = true;
      void (id === "open" ? engine.open() : engine.close());
    },
    onUpdate: fn => {
      updateCb = fn;
    },
    onVelocity: () => {},
    getEngine: () => null,
  };
};
