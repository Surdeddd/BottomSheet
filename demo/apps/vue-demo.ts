import { createApp, defineComponent, h, ref, type App } from "vue";
import { BottomSheet } from "@surdeddd/bottom-sheet/vue";
import {
  allowedFromSnaps,
  buildShell,
  demoRows,
  snapPoints,
  type DemoController,
  type DemoSettings,
} from "./shared";

export const mountVueDemo = (
  host: HTMLElement,
  settings: DemoSettings,
): DemoController => {
  buildShell(host, "Issue 02 · Vue 3");
  const mountPoint = document.createElement("div");
  host.firstElementChild!.appendChild(mountPoint);

  let sheetHandle: {
    snapTo: (id: string) => Promise<void>;
    state: any;
    getEngine?: () => any | null;
  } | null = null;
  let updateCb: ((s: any) => void) | null = null;
  let velocityCb: ((v: number) => void) | null = null;
  let interval: number | null = null;
  let lastSize = 0;
  let lastTs = performance.now();

  const VueApp = defineComponent({
    setup() {
      const sheetRef = ref<any>(null);

      const startPolling = () => {
        sheetHandle = sheetRef.value;
        interval = window.setInterval(() => {
          if (!sheetHandle) return;
          const state = sheetHandle.state;
          updateCb?.(state);
          const now = performance.now();
          const dt = now - lastTs;
          if (dt > 0) velocityCb?.((state.size - lastSize) / dt);
          lastSize = state.size;
          lastTs = now;
        }, 33);
      };

      return () =>
        h(
          BottomSheet,
          {
            ref: (el: any) => {
              sheetRef.value = el;
              if (el && !interval) startPolling();
            },
            mode: (settings.mode === "overlay" ? "bottom" : settings.mode) as
      | "bottom"
      | "top"
      | "left"
      | "right",
            snapPoints: snapPoints(settings.mode),
            allowed: allowedFromSnaps(settings.mode),
            initial: settings.initial,
            animation: "spring" as const,
            spring: { stiffness: settings.stiffness, damping: settings.damping },
            focusTrap: settings.focusTrap,
            closeOnEscape: settings.closeOnEscape,
            rubberBand: settings.rubberBand,
            backdropRange: [0.4, 1] as [number, number],
            lockBodyScroll: false,
            teleport: false,
          },
          {
            header: () =>
              h("div", { class: "sheet-header" }, [
                h("h2", null, "Active routes"),
                h("span", { class: "hint" }, "VUE 3 · COMPOSABLE"),
              ]),
            default: () =>
              h(
                "div",
                { class: "sheet-list" },
                demoRows.map(([title, sub]) =>
                  h("div", { class: "sheet-item" }, [
                    h("div", { class: "sheet-item-dot" }),
                    h("div", { class: "sheet-item-text" }, [
                      h("strong", null, title),
                      h("span", null, sub),
                    ]),
                  ]),
                ),
              ),
          },
        );
    },
  });

  const app: App = createApp(VueApp);
  app.mount(mountPoint);

  return {
    destroy: () => {
      if (interval) clearInterval(interval);
      app.unmount();
    },
    snapTo: (id: string) => {
      void sheetHandle?.snapTo(id);
    },
    onUpdate: (fn: (s: any) => void) => {
      updateCb = fn;
    },
    onVelocity: (fn: (v: number) => void) => {
      velocityCb = fn;
    },
    getEngine: () => sheetHandle?.getEngine?.() ?? null,
  };
};
