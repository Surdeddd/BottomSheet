import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "@surdeddd/bottom-sheet/element";
import type { BottomSheetElement } from "@surdeddd/bottom-sheet/element";
import type { EngineState } from "@surdeddd/bottom-sheet";
import {
  allowedFromSnaps,
  buildShell,
  demoRows,
  snapPoints,
  type DemoController,
  type DemoSettings,
} from "./shared";

class LitDemoSheet extends LitElement {
  static override properties = {
    settings: { attribute: false },
  };

  declare settings: DemoSettings;

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): unknown {
    const mode = this.settings.mode === "overlay" ? "bottom" : this.settings.mode;
    return html`
      <bottom-sheet
        mode=${mode}
        snap-points=${JSON.stringify(snapPoints(mode))}
        initial=${this.settings.initial}
        allowed=${allowedFromSnaps(this.settings.mode).join(",")}
        animation="spring"
        focus-trap=${String(this.settings.focusTrap)}
        close-on-escape=${String(this.settings.closeOnEscape)}
        lock-body-scroll="false"
        stylesheet="/style.css"
      >
        <div slot="header" class="sheet-header">
          <h2>Active routes</h2>
          <span class="hint">LIT · LITELEMENT</span>
        </div>
        <div class="sheet-list">
          ${repeat(
            demoRows,
            ([title]) => title,
            ([title, sub]) => html`
              <div class="sheet-item">
                <div class="sheet-item-dot"></div>
                <div class="sheet-item-text">
                  <strong>${title}</strong><span>${sub}</span>
                </div>
              </div>
            `,
          )}
        </div>
      </bottom-sheet>
    `;
  }

  getSheet(): BottomSheetElement | null {
    return this.querySelector("bottom-sheet") as BottomSheetElement | null;
  }
}

if (!customElements.get("lit-demo-sheet")) {
  customElements.define("lit-demo-sheet", LitDemoSheet);
}

export const mountLitDemo = (
  host: HTMLElement,
  settings: DemoSettings,
): DemoController => {
  const shell = buildShell(host, "Issue 05 · Lit");

  const litRoot = document.createElement("lit-demo-sheet") as LitDemoSheet;
  litRoot.settings = settings;
  shell.append(litRoot);

  let updateCb: ((s: EngineState) => void) | null = null;
  let velocityCb: ((v: number) => void) | null = null;
  let lastSize = 0;
  let lastTs = performance.now();
  let interval: number | null = null;

  requestAnimationFrame(() => {
    interval = window.setInterval(() => {
      const sheet = litRoot.getSheet();
      const state = sheet?.sheetState;
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
      litRoot.remove();
    },
    snapTo: (id: string) => {
      void litRoot.getSheet()?.snapTo(id);
    },
    onUpdate: (fn: (s: EngineState) => void) => {
      updateCb = fn;
    },
    onVelocity: (fn: (v: number) => void) => {
      velocityCb = fn;
    },
    getEngine: () => litRoot.getSheet()?.getEngine() ?? null,
  };
};
