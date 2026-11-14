import type { EngineFeature } from "@surdeddd/bottom-sheet";
import type { WebGLUnsupportedReason } from "@surdeddd/bottom-sheet/webgl";
import type { DemoSettings } from "../apps/shared";
import { hasHardwareWebGL } from "./hero-3d/capability";
import { t } from "./i18n";

type Factory = typeof import("@surdeddd/bottom-sheet/webgl").webglRenderer;
type Outcome = WebGLUnsupportedReason | "failed" | null;

let factory: Factory | null = null;
let report: (reason: WebGLUnsupportedReason) => void = () => {};

export const loadRenderer = async (): Promise<void> => {
  factory ??= (await import("@surdeddd/bottom-sheet/webgl")).webglRenderer;
};

export const demoFeatures = (
  settings: DemoSettings,
): EngineFeature[] | undefined =>
  settings.webgl && settings.mode !== "overlay" && factory
    ? [
        factory({
          allowSoftware: settings.webglOnCpu,
          onUnsupported: reason => report(reason),
        }),
      ]
    : undefined;

export type RendererSwitchOptions = {
  settings: DemoSettings;
  remount: () => void;
};

export const wireRendererSwitch = (
  opts: RendererSwitchOptions,
): { sync: () => void } => {
  const { settings } = opts;
  const toggle = document.getElementById("tg-webgl") as HTMLInputElement | null;
  const note = document.getElementById("renderer-note");
  const force = document.getElementById("renderer-force");
  let outcome: Outcome = null;

  const noteKey = (): string => {
    if (settings.mode === "overlay") return "overlay";
    if (outcome) return outcome;
    if (!settings.webgl) return "dom";
    return settings.webglOnCpu && !hasHardwareWebGL() ? "cpu" : "webgl";
  };

  const render = (): void => {
    const key = noteKey();
    if (toggle) {
      toggle.checked = settings.webgl;
      toggle.disabled = settings.mode === "overlay";
    }
    if (note) {
      note.dataset.i18n = `ctrl.webgl.note.${key}`;
      note.textContent = t(note.dataset.i18n);
    }
    if (force) force.hidden = key !== "software-renderer";
  };

  report = reason => {
    outcome = reason;
    render();
  };

  const choose = async (webgl: boolean): Promise<void> => {
    outcome = null;
    if (webgl) {
      try {
        await loadRenderer();
      } catch {
        outcome = "failed";
        render();
        return;
      }
    }
    settings.webgl = webgl;
    if (!webgl) settings.webglOnCpu = false;
    opts.remount();
  };

  toggle?.addEventListener("change", () => void choose(toggle.checked));
  force?.addEventListener("click", () => {
    settings.webglOnCpu = true;
    opts.remount();
  });

  render();
  return {
    sync: () => {
      outcome = null;
      render();
    },
  };
};
