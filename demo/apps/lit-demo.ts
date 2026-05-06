import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "@surdeddd/bottom-sheet/element"; // registers <bottom-sheet>
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

/**
 * LitElement wrapper around the existing <bottom-sheet> custom element.
 *
 * We deliberately disable Shadow DOM for this host (createRenderRoot returns
 * `this`). Reasons:
 *   1. The inner <bottom-sheet> already owns its own shadow root; nesting it
 *      inside ours would block page CSS from styling the slotted content
 *      (the demo's `.sheet-header`, `.sheet-list`, `.sheet-item` rules live
 *      in /style.css and target light-DOM children).
 *   2. We need to query the inner sheet from outside (`getSheet()`) to poll
 *      `sheetState` for the live readouts — easier without an extra shadow
 *      boundary in the way.
 */
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

  // Wait one frame so Lit renders and the inner <bottom-sheet> is connected
  // to the DOM (and therefore has its engine wired up + sheetState available).
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
  };
};
