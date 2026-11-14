import {
  OverlayEngine,
  type OverlayOptions,
  type OverlayState,
} from "@surdeddd/bottom-sheet/overlay";

export type LabOverlayOptions = Omit<
  OverlayOptions,
  | "element"
  | "backdrop"
  | "returnFocus"
  | "initialFocus"
  | "mountTo"
  | "onOpen"
  | "onClose"
> & {
  returnFocus?: string;
  initialFocus?: string;
  mountTo?: "body" | "parent";
};

type Mounted = {
  engine: OverlayEngine;
  root: HTMLElement;
  panel: HTMLElement;
  events: string[];
};

let current: Mounted | null = null;

const mounted = (): Mounted => {
  if (!current) throw new Error("no overlay mounted");
  return current;
};

const button = (id: string): HTMLButtonElement => {
  const node = document.createElement("button");
  node.type = "button";
  node.id = id;
  node.textContent = id;
  return node;
};

export const overlayLab = {
  mount(options: LabOverlayOptions = {}): void {
    overlayLab.unmount();
    const { returnFocus, ...rest } = options;

    const root = document.createElement("div");
    root.className = "ovl-root";
    root.id = "ovl-root";
    const backdrop = document.createElement("div");
    backdrop.className = "ovl-backdrop";
    backdrop.id = "ovl-backdrop";
    const panel = document.createElement("section");
    panel.className = "ovl-panel";
    panel.id = "ovl-panel";
    panel.dataset.edge = options.edge ?? "bottom";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Overlay");
    const body = document.createElement("div");
    body.className = "lab-overlay";
    const field = document.createElement("input");
    field.id = "ovl-field";
    field.setAttribute("aria-label", "field");
    body.append(button("ovl-first"), field, button("ovl-last"));
    panel.append(body);
    root.append(backdrop, panel);
    document.getElementById("overlay-mount")!.append(root);

    const events: string[] = [];
    const engine = new OverlayEngine({
      duration: 120,
      ...rest,
      element: panel,
      backdrop,
      ...(returnFocus
        ? {
            returnFocus: () => document.querySelector<HTMLElement>(returnFocus),
          }
        : {}),
      onOpen: () => events.push("onOpen"),
      onClose: () => events.push("onClose"),
    });
    engine.on("before-open", () => events.push("before-open"));
    engine.on("open", () => events.push("open"));
    engine.on("before-close", () => events.push("before-close"));
    engine.on("close", payload => events.push(`close:${payload.reason}`));
    current = { engine, root, panel, events };
  },
  unmount(): void {
    if (!current) return;
    current.engine.destroy();
    current.root.remove();
    current.panel.remove();
    current = null;
  },
  engine(): OverlayEngine {
    return mounted().engine;
  },
  state(): OverlayState {
    return { ...mounted().engine.state };
  },
  events(): string[] {
    return [...mounted().events];
  },
  settled(): Promise<OverlayState> {
    const started = performance.now();
    return new Promise((resolve, reject) => {
      const check = (): void => {
        const state = mounted().engine.state;
        if (!state.isAnimating) {
          resolve({ ...state });
          return;
        }
        if (performance.now() - started > 4000) {
          reject(new Error("overlay never settled"));
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  },
};
