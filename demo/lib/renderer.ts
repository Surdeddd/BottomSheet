import type { EngineFeature } from "@surdeddd/bottom-sheet";
import type { WebGLUnsupportedReason } from "@surdeddd/bottom-sheet/webgl";
import type { DemoSettings } from "../apps/shared";
import { JELLY } from "./codegen/renderer";
import { hasHardwareWebGL } from "./hero-3d/capability";
import { t } from "./i18n";

type Module = typeof import("@surdeddd/bottom-sheet/webgl");
type Outcome = WebGLUnsupportedReason | "failed" | null;

let renderer: Module | null = null;
let report: (reason: WebGLUnsupportedReason) => void = () => {};

export const loadRenderer = async (): Promise<void> => {
  renderer ??= await import("@surdeddd/bottom-sheet/webgl");
};

export const demoFeatures = (
  settings: DemoSettings,
): EngineFeature[] | undefined =>
  settings.webgl && settings.mode !== "overlay" && renderer
    ? [
        renderer.webglRenderer({
          jelly: settings.webglJelly ? JELLY : undefined,
          lift:
            settings.webglJelly && settings.webglLift
              ? renderer.contentLift()
              : undefined,
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
  const container = document.getElementById("renderer-switch");
  const toggle = document.getElementById("tg-webgl") as HTMLInputElement | null;
  let revealed = false;
  const jelly = document.getElementById(
    "tg-webgl-jelly",
  ) as HTMLInputElement | null;
  const lift = document.getElementById(
    "tg-webgl-lift",
  ) as HTMLInputElement | null;
  const note = document.getElementById("renderer-note");
  const force = document.getElementById("renderer-force");
  let outcome: Outcome = null;

  const noteKey = (): string => {
    if (settings.mode === "overlay") return "overlay";
    if (outcome) return outcome;
    if (!settings.webgl) return "dom";
    if (settings.webglOnCpu && !hasHardwareWebGL()) return "cpu";
    if (!settings.webglJelly) return "webgl";
    return settings.webglLift ? "lifted" : "bent";
  };

  const render = (): void => {
    if (settings.webgl) revealed = true;
    if (container) container.hidden = !revealed;
    const key = noteKey();
    if (toggle) {
      toggle.checked = settings.webgl;
      toggle.disabled = settings.mode === "overlay";
    }
    const bent = settings.webgl && settings.webglJelly;
    if (jelly) {
      jelly.checked = bent;
      jelly.disabled = !settings.webgl || settings.mode === "overlay";
    }
    if (lift) {
      lift.checked = bent && settings.webglLift;
      lift.disabled = !bent || settings.mode === "overlay";
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
    if (!webgl) {
      settings.webglOnCpu = false;
      settings.webglJelly = false;
      settings.webglLift = false;
    }
    opts.remount();
  };

  toggle?.addEventListener("change", () => void choose(toggle.checked));
  jelly?.addEventListener("change", () => {
    settings.webglJelly = jelly.checked;
    if (!jelly.checked) settings.webglLift = false;
    opts.remount();
  });
  lift?.addEventListener("change", () => {
    settings.webglLift = lift.checked;
    opts.remount();
  });
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
