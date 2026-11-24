import {
  BottomSheetEngine,
  type AnchorOptions,
  type EngineOptions,
  type EngineState,
  type ScrimOverlayOptions,
  type ScrimStageDef,
} from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";
import { elementLab } from "./features-element";
import { overlayLab } from "./features-overlay";

type Passthrough = Omit<
  Partial<EngineOptions>,
  | "element"
  | "handle"
  | "scrollContainer"
  | "backdrop"
  | "scrim"
  | "screenComponent"
  | "easing"
  | "returnFocusTo"
  | "initialFocus"
  | "linkedSheets"
  | "features"
>;

export type LabOptions = Passthrough & {
  rows?: number;
  panel?: { width: number; height: number; positioned?: boolean };
  dir?: "ltr" | "rtl";
  veto?: string;
  vetoClose?: boolean;
  returnFocusTo?: string;
  initialFocus?: string | false;
};

export type LabAnchor = Omit<AnchorOptions, "element" | "showOn"> & {
  showOn?: string[];
  minSize?: number;
};

export type LabStage = Omit<ScrimStageDef, "element">;

export type LabScrimOverlay = Omit<ScrimOverlayOptions, "children">;

type Mounted = {
  engine: BottomSheetEngine;
  root: HTMLElement;
  host: HTMLElement;
  sheet: HTMLElement;
  events: string[];
  drags: number;
  progress: number[];
  snaps: Array<{ id: string; size: number; progress: number }>;
  extras: Array<() => void>;
};

let serial = 0;

const label = (prefix: string): HTMLElement => {
  const node = document.createElement("button");
  node.type = "button";
  node.id = `${prefix}-${serial++}`;
  node.className = "lab-tag";
  node.textContent = node.id;
  return node;
};

const DEFAULT_SNAPS: EngineOptions["snapPoints"] = [
  { id: "closed", size: 0 },
  { id: "peek", size: 120 },
  { id: "half", size: 300 },
  { id: "full", size: 500 },
];

const mountPoint = document.getElementById("mount")!;
const sheets: Mounted[] = [];

const tag = <K extends keyof HTMLElementTagNameMap>(
  name: K,
  className: string,
  id: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.id = id;
  return node;
};

const build = (options: LabOptions, index: number): Mounted => {
  const {
    rows = 30,
    panel,
    dir,
    veto,
    vetoClose,
    returnFocusTo,
    initialFocus,
    ...engineOptions
  } = options;
  document.documentElement.dir = dir ?? "ltr";

  const root = tag("div", "bs-root", `root-${index}`);
  const backdrop = tag("div", "bs-backdrop", `backdrop-${index}`);
  const scrim = tag("div", "bs-screen", `scrim-${index}`);
  const sheet = tag("section", "bs-sheet", `sheet-${index}`);
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", `Sheet ${index}`);

  const handle = tag("div", "bs-handle", `handle-${index}`);
  handle.setAttribute("role", "slider");
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("aria-label", "Resize sheet");

  const header = tag("div", "bs-header", `header-${index}`);
  const title = document.createElement("h2");
  title.textContent = `Sheet ${index}`;
  const first = tag("button", "", `first-${index}`);
  first.type = "button";
  first.textContent = "first";
  header.append(title, first);

  const content = tag("div", "bs-content", `content-${index}`);
  for (let i = 0; i < rows; i++) {
    const row = document.createElement("div");
    row.className = "lab-row";
    row.textContent = `Row ${i + 1}`;
    content.append(row);
  }
  const field = tag("input", "", `field-${index}`);
  field.setAttribute("aria-label", "field");
  const last = tag("button", "", `last-${index}`);
  last.type = "button";
  last.textContent = "last";
  content.append(field, last);

  sheet.append(handle, header, content);
  root.append(backdrop, scrim, sheet);
  let host: HTMLElement = root;
  if (panel) {
    host = tag("div", "lab-panel", `panel-${index}`);
    host.style.cssText = `width:${panel.width}px;height:${panel.height}px;margin:80px 0 0 40px;overflow:hidden;background:#eef`;
    if (panel.positioned !== false) host.style.position = "relative";
    host.append(root);
  }
  mountPoint.append(host);

  const engine = new BottomSheetEngine({
    snapPoints: DEFAULT_SNAPS,
    initial: "peek",
    animation: "tween",
    duration: 120,
    ...engineOptions,
    element: sheet,
    handle,
    scrollContainer: content,
    backdrop,
    scrim,
    ...(initialFocus !== undefined ? { initialFocus } : {}),
    ...(returnFocusTo
      ? {
          returnFocusTo: () =>
            document.querySelector<HTMLElement>(returnFocusTo),
        }
      : {}),
  });

  const mounted: Mounted = {
    engine,
    root,
    host,
    sheet,
    events: [],
    drags: 0,
    progress: [],
    snaps: [],
    extras: [],
  };
  const log = (entry: string): void => {
    mounted.events.push(entry);
  };
  engine.on("before-snap", payload => {
    log(`before-snap:${payload.id}`);
    if (veto && payload.id === veto) payload.cancel();
  });
  engine.on("before-close", payload => {
    log(`before-close:${payload.reason}`);
    if (vetoClose) payload.cancel();
  });
  engine.on("snap", payload => {
    log(`snap:${payload.id}`);
    mounted.snaps.push({ ...payload });
  });
  engine.on("open", payload => log(`open:${payload.id}`));
  engine.on("opened", payload => log(`opened:${payload.id}`));
  engine.on("close", () => log("close"));
  engine.on("closed", () => log("closed"));
  engine.on("dragstart", () => log("dragstart"));
  engine.on("dragend", () => log("dragend"));
  engine.on("drag", () => {
    mounted.drags++;
  });
  engine.on("progress", payload => {
    mounted.progress.push(payload.value);
  });
  backdrop.addEventListener("click", () => void engine.close("backdrop"));
  return mounted;
};

const at = (index: number): Mounted => {
  const mounted = sheets[index];
  if (!mounted) throw new Error(`no sheet ${index}`);
  return mounted;
};

const lab = {
  mount(options: LabOptions = {}, keep = false): number {
    if (!keep) lab.unmount();
    sheets.push(build(options, sheets.length));
    return sheets.length - 1;
  },
  unmount(): void {
    for (const mounted of sheets.splice(0)) {
      for (const drop of mounted.extras.splice(0)) drop();
      mounted.engine.destroy();
      mounted.host.remove();
    }
  },
  engine(index = 0): BottomSheetEngine {
    return at(index).engine;
  },
  state(index = 0): EngineState {
    return { ...at(index).engine.state };
  },
  events(index = 0): string[] {
    return [...at(index).events];
  },
  drags(index = 0): number {
    return at(index).drags;
  },
  clear(index = 0): void {
    at(index).events.length = 0;
    at(index).drags = 0;
    at(index).progress.length = 0;
    at(index).snaps.length = 0;
  },
  progress(index = 0): number[] {
    return [...at(index).progress];
  },
  snaps(index = 0): Array<{ id: string; size: number; progress: number }> {
    return at(index).snaps.map(snap => ({ ...snap }));
  },
  anchor(options: LabAnchor = {}, index = 0): string {
    const { minSize, showOn, ...rest } = options;
    const element = label("anchor");
    const mounted = at(index);
    mounted.extras.push(
      mounted.engine.addAnchor({
        ...rest,
        element,
        showOn:
          minSize === undefined ? showOn : state => state.size >= minSize,
      }),
    );
    return element.id;
  },
  stages(stages: LabStage[] | null, index = 0): string[] {
    const mounted = at(index);
    if (!stages) {
      mounted.engine.setScrimStages(null);
      return [];
    }
    const elements = stages.map(() => label("stage"));
    mounted.extras.push(
      mounted.engine.setScrimStages({
        animation: "none",
        stages: stages.map((stage, i) => ({ ...stage, element: elements[i]! })),
      }),
    );
    return elements.map(element => element.id);
  },
  scrimOverlay(options: LabScrimOverlay = {}, index = 0): string {
    const children = label("floating");
    const mounted = at(index);
    mounted.extras.push(
      mounted.engine.setScrimOverlay({ ...options, children }),
    );
    return children.id;
  },
  dropExtras(index = 0): void {
    for (const drop of at(index).extras.splice(0)) drop();
  },
  visible(index = 0): number {
    const { engine, sheet } = at(index);
    const box = sheet.getBoundingClientRect();
    switch (engine.getMode()) {
      case "top":
        return box.bottom;
      case "left":
        return box.right;
      case "right":
        return window.innerWidth - box.left;
      default:
        return window.innerHeight - box.top;
    }
  },
  settled(index = 0): Promise<EngineState> {
    const { engine } = at(index);
    const started = performance.now();
    return new Promise((resolve, reject) => {
      const check = (): void => {
        const state = engine.state;
        const resting = state.phase === "open" || state.phase === "closed";
        if (resting && !state.isAnimating && !state.isDragging) {
          resolve({ ...state });
          return;
        }
        if (performance.now() - started > 4000) {
          reject(new Error(`sheet ${index} never settled: ${state.phase}`));
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  },
  link(a: number, b: number): void {
    at(a).engine.setLinkedSheets([at(b).engine]);
    at(b).engine.setLinkedSheets([at(a).engine]);
  },
};

export type Lab = typeof lab;

declare global {
  interface Window {
    lab: Lab;
    elementLab: typeof elementLab;
    overlayLab: typeof overlayLab;
  }
}

window.lab = lab;
window.elementLab = elementLab;
window.overlayLab = overlayLab;
