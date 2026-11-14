import type { EngineState } from "@surdeddd/bottom-sheet";
import {
  defineBottomSheet,
  type BottomSheetElement,
} from "@surdeddd/bottom-sheet/element";

defineBottomSheet();

const EVENTS = [
  "before-snap",
  "snap",
  "open",
  "opened",
  "before-close",
  "close",
  "closed",
  "drag-start",
  "drag-end",
] as const;

type Veto = { snap?: string; close?: boolean };
type Detail = { id?: string; reason?: string } | null | undefined;

let current: BottomSheetElement | null = null;
let log: string[] = [];

const element = (): BottomSheetElement => {
  if (!current) throw new Error("no <bottom-sheet> mounted");
  return current;
};

const part = (name: string): HTMLElement => {
  const node = element().shadowRoot?.querySelector<HTMLElement>(
    `[part~="${name}"]`,
  );
  if (!node) throw new Error(`no part ${name}`);
  return node;
};

export const elementLab = {
  mount(markup: string, veto: Veto = {}): void {
    elementLab.unmount();
    log = [];
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    const node = template.content.firstElementChild as BottomSheetElement;
    for (const name of EVENTS) {
      node.addEventListener(name, event => {
        const detail = (event as CustomEvent<Detail>).detail;
        const tail = detail?.id ?? detail?.reason;
        log.push(tail ? `${name}:${tail}` : name);
        if (name === "before-snap" && veto.snap && detail?.id === veto.snap) {
          event.preventDefault();
        }
        if (name === "before-close" && veto.close) event.preventDefault();
      });
    }
    document.getElementById("element-mount")!.append(node);
    current = node;
  },
  unmount(): void {
    current?.remove();
    current = null;
  },
  el: element,
  part,
  define(name: string): void {
    defineBottomSheet(name);
  },
  events(): string[] {
    return [...log];
  },
  clear(): void {
    log.length = 0;
  },
  state(): EngineState | null {
    const state = element().sheetState;
    return state ? { ...state } : null;
  },
  box(name: string): { top: number; left: number; width: number; height: number } {
    const rect = part(name).getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  },
  visible(): number {
    const rect = part("sheet").getBoundingClientRect();
    switch (element().getEngine()?.getMode()) {
      case "top":
        return rect.bottom;
      case "left":
        return rect.right;
      case "right":
        return window.innerWidth - rect.left;
      default:
        return window.innerHeight - rect.top;
    }
  },
  settled(): Promise<EngineState> {
    const started = performance.now();
    return new Promise((resolve, reject) => {
      const check = (): void => {
        const state = element().sheetState;
        if (
          state &&
          (state.phase === "open" || state.phase === "closed") &&
          !state.isAnimating &&
          !state.isDragging
        ) {
          resolve({ ...state });
          return;
        }
        if (performance.now() - started > 4000) {
          reject(new Error(`element never settled: ${state?.phase}`));
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  },
};
