import type { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { t } from "./i18n";
import type { Settings, ScrimPresetKey } from "./types";

export type ScrimControlsOptions = {
  getEngine: () => BottomSheetEngine | null;
  settings?: Settings;
  onChange?: () => void;
};

type ChipPreset = "off" | "subtle" | "standard" | "monitoring" | "cinematic";

const PRESETS: Record<ChipPreset, { color: string; blur: string | null }> = {
  off:        { color: "rgba(0,0,0,0)",          blur: null },
  subtle:     { color: "rgba(0, 0, 0, 0.20)",    blur: null },
  standard:   { color: "rgba(0, 0, 0, 0.40)",    blur: null },
  monitoring: { color: "rgba(15, 15, 20, 0.55)", blur: "4px" },
  cinematic:  { color: "rgba(0, 0, 0, 0.70)",    blur: "12px" },
};

let floatingTeardown: (() => void) | null = null;

export const wireScrimControls = (opts: ScrimControlsOptions): {
  syncToEngine: () => void;
} => {
  const chips = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-scrim-preset]"),
  );
  const aboveToggle = document.getElementById("tg-scrim-above") as HTMLInputElement | null;
  const tapToggle = document.getElementById("tg-scrim-tap") as HTMLInputElement | null;
  const floatingToggle = document.getElementById("tg-scrim-floating") as HTMLInputElement | null;
  if (chips.length === 0) return { syncToEngine: () => {} };

  let preset: ChipPreset = "monitoring";

  const applyPreset = (): void => {
    const engine = opts.getEngine();
    if (!engine) return;
    const e = engine;
    if (preset === "off") {
      e.setScrimMode("off");
      e.setScrimEnabled(false);
      return;
    }
    e.setScrimEnabled(true);
    e.setScrimMode(aboveToggle?.checked ? "above-sheet" : "full");
    const cfg = PRESETS[preset];
    e.setScrim({
      color: cfg.color,
      blur: cfg.blur,
      interactive: tapToggle?.checked ?? false,
    });
  };

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      preset = chip.dataset.scrimPreset as ChipPreset;
      chips.forEach(c =>
        c.classList.toggle("is-active", c.dataset.scrimPreset === preset),
      );
      applyPreset();
      if (opts.settings) {
        opts.settings.scrimPreset = preset as ScrimPresetKey;
      }
      opts.onChange?.();
    });
  });

  aboveToggle?.addEventListener("change", () => {
    if (preset === "off") return;
    const engine = opts.getEngine();
    if (!engine) return;
    engine.setScrimMode(aboveToggle.checked ? "above-sheet" : "full");
    if (opts.settings) opts.settings.scrimAboveSheet = aboveToggle.checked;
    opts.onChange?.();
  });

  tapToggle?.addEventListener("change", () => {
    const engine = opts.getEngine();
    if (!engine) return;
    engine.setScrimTapToClose(tapToggle.checked);
    if (opts.settings) opts.settings.scrimTapToClose = tapToggle.checked;
    opts.onChange?.();
  });

  floatingToggle?.addEventListener("change", () => {
    if (floatingToggle.checked) {
      floatingTeardown?.();
      floatingTeardown = buildFloatingAction();
    } else {
      floatingTeardown?.();
      floatingTeardown = null;
    }
    if (opts.settings) opts.settings.scrimFloatingAction = floatingToggle.checked;
    opts.onChange?.();
  });

  const buildFloatingAction = (): (() => void) | null => {
    const engine = opts.getEngine();
    if (!engine) return null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "floating-action";
    btn.textContent = t("ctrl.scrim.floating.btn");
    btn.addEventListener("click", () => {
      const live = opts.getEngine();
      if (!live) return;
      const allowed = live.getAllowedIds();
      const target =
        allowed.includes("full")
          ? "full"
          : allowed.find(id => id !== "closed") ?? allowed[0];
      if (target) void live.snapTo(target);
    });
    return engine.setScrimOverlay({
      children: btn,
      position: "sheet-top-right",
      interactive: true,
    });
  };

  if (opts.settings) {
    if (aboveToggle) aboveToggle.checked = opts.settings.scrimAboveSheet ?? aboveToggle.checked;
    if (tapToggle) tapToggle.checked = opts.settings.scrimTapToClose ?? tapToggle.checked;
    if (floatingToggle) floatingToggle.checked = opts.settings.scrimFloatingAction ?? floatingToggle.checked;
    if (opts.settings.scrimPreset) {
      preset = opts.settings.scrimPreset as ChipPreset;
      chips.forEach(c =>
        c.classList.toggle("is-active", c.dataset.scrimPreset === preset),
      );
    }
  }

  applyPreset();
  if (floatingToggle?.checked) {
    floatingTeardown = buildFloatingAction();
  }

  const syncToEngine = (): void => {
    floatingTeardown = null;
    applyPreset();
    if (floatingToggle?.checked) {
      floatingTeardown = buildFloatingAction();
    }
  };

  return { syncToEngine };
};
