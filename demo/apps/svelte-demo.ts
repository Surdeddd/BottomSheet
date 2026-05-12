import { mount, unmount } from "svelte";
import type { EngineState, SheetMode } from "../../src/core/types";
import SvelteDemoApp from "./SvelteDemoApp.svelte";
import {
  allowedFromSnaps,
  buildShell,
  demoRows,
  snapPoints,
  type DemoController,
  type DemoSettings,
} from "./shared";

type SvelteAppHandle = {
  snapTo: (id: string) => Promise<void>;
  getState: () => EngineState | undefined;
  getEngine?: () => any | null;
};

export const mountSvelteDemo = (
  host: HTMLElement,
  settings: DemoSettings,
): DemoController => {
  const shell = buildShell(host, "Issue 03 · Svelte");
  const mountPoint = document.createElement("div");
  shell.append(mountPoint);

  let lastState: EngineState | null = null;
  const mode: SheetMode = settings.mode === "overlay" ? "bottom" : settings.mode;

  const app = mount(SvelteDemoApp, {
    target: mountPoint,
    props: {
      snapPoints: snapPoints(settings.mode),
      allowed: allowedFromSnaps(settings.mode),
      initial: settings.initial,
      mode,
      spring: { stiffness: settings.stiffness, damping: settings.damping },
      focusTrap: settings.focusTrap,
      closeOnEscape: settings.closeOnEscape,
      rubberBand: settings.rubberBand,
      rows: demoRows,
      onstate: (s: EngineState) => {
        lastState = s;
      },
    },
  }) as unknown as SvelteAppHandle;

  let updateCb: ((s: EngineState) => void) | null = null;
  let velocityCb: ((v: number) => void) | null = null;
  let lastSize = 0;
  let lastTs = performance.now();

  const interval = window.setInterval(() => {
    const state = lastState ?? app.getState();
    if (!state) return;
    updateCb?.(state);
    const now = performance.now();
    const dt = now - lastTs;
    if (dt > 0) velocityCb?.((state.size - lastSize) / dt);
    lastSize = state.size;
    lastTs = now;
  }, 33);

  return {
    destroy: () => {
      clearInterval(interval);
      void unmount(app as unknown as Record<string, unknown>);
      mountPoint.remove();
    },
    snapTo: (id: string) => {
      void app.snapTo(id);
    },
    onUpdate: fn => {
      updateCb = fn;
    },
    onVelocity: fn => {
      velocityCb = fn;
    },
    getEngine: () => app.getEngine?.() ?? null,
  };
};
