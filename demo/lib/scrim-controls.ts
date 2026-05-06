import type { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { t } from "./i18n";

/**
 * Wires the Scrim chip-row + 3 toggles in the existing controls section to
 * the active engine via runtime setters. Reads `getEngine()` lazily so an
 * adapter remount (mode/snap change) never writes to a destroyed instance —
 * the engine's setters also no-op on `destroyed`, so a stale teardown that
 * fires after the controller swap is harmless.
 *
 * Visual presets keep their values in one place — flipping a toggle does
 * NOT switch to "custom" because all toggles map to engine flags that aren't
 * part of the preset table. The "off" preset is a UI-only marker: the engine
 * does the actual work via `setScrimMode("off")` + `setScrimEnabled(false)`,
 * so the local color/blur entry can be transparent placeholder values.
 */
export type ScrimControlsOptions = {
  getEngine: () => BottomSheetEngine | null;
};

// Local preset key — extends the engine's `ScrimPreset` with a UI-only "off".
// Kept here (not exported from the engine) because "off" isn't a visual
// preset; it's a wholesale disable that needs different setter wiring.
type ChipPreset = "off" | "subtle" | "standard" | "monitoring" | "cinematic";

const PRESETS: Record<ChipPreset, { color: string; blur: string | null }> = {
  // "off" stays fully transparent — the engine's setScrimEnabled(false) +
  // setScrimMode("off") detach the visual, but if a later toggle re-enables
  // the scrim, these placeholder values won't bleed through (other chip
  // selection always overrides them on click).
  off:        { color: "rgba(0,0,0,0)",          blur: null },
  subtle:     { color: "rgba(0, 0, 0, 0.20)",    blur: null },
  standard:   { color: "rgba(0, 0, 0, 0.40)",    blur: null },
  monitoring: { color: "rgba(15, 15, 20, 0.55)", blur: "4px" },
  cinematic:  { color: "rgba(0, 0, 0, 0.70)",    blur: "12px" },
};

// Module-local because the floating-action overlay is a singleton — toggling
// the checkbox repeatedly should reuse the same teardown slot, not stack
// multiple injected wrappers. `null` means "no overlay currently mounted".
let floatingTeardown: (() => void) | null = null;

export const wireScrimControls = (opts: ScrimControlsOptions): void => {
  const chips = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-scrim-preset]"),
  );
  const aboveToggle = document.getElementById("tg-scrim-above") as HTMLInputElement | null;
  const tapToggle = document.getElementById("tg-scrim-tap") as HTMLInputElement | null;
  const floatingToggle = document.getElementById("tg-scrim-floating") as HTMLInputElement | null;
  if (chips.length === 0) return;

  let preset: ChipPreset = "monitoring";

  // Apply the current visual preset to the engine. Split into two branches
  // because "off" needs setScrimEnabled(false) + setScrimMode("off") while
  // the other presets need re-enable + a mode flip + setScrim() colors.
  const applyPreset = (): void => {
    const engine = opts.getEngine();
    if (!engine) return;
    const e = engine;
    if (preset === "off") {
      // Order matters: mode first so the screen detaches/transparent before
      // disabling — avoids a flash of dimmed pixels.
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
      // Tap-to-close requires the scrim to receive pointer events, otherwise
      // the click listener never fires.
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
    });
  });

  // "above-sheet" toggle: route through setScrimMode so the engine flips
  // the scrim's positioning context without an adapter remount. If the user
  // currently has "off" selected, leave it alone — toggling above doesn't
  // imply re-enabling.
  aboveToggle?.addEventListener("change", () => {
    if (preset === "off") return;
    const engine = opts.getEngine();
    if (!engine) return;
    engine.setScrimMode(aboveToggle.checked ? "above-sheet" : "full");
  });

  // tap-to-close toggle: dedicated setter, no remount.
  tapToggle?.addEventListener("change", () => {
    const engine = opts.getEngine();
    if (!engine) return;
    engine.setScrimTapToClose(tapToggle.checked);
  });

  // floating-action toggle: build a vanilla button (no innerHTML — security
  // hook in this repo blocks innerHTML at lint time) and inject as a scrim
  // overlay. NOTE: the "off" chip and this toggle are independent — turning
  // the scrim off doesn't auto-untick this; the wrapper element will simply
  // be hidden along with the scrim host (display:none chain). User keeps
  // explicit control.
  floatingToggle?.addEventListener("change", () => {
    const engine = opts.getEngine();
    if (!engine) return;
    if (floatingToggle.checked) {
      // Tear down any prior overlay first — guards against double-injection
      // if the toggle event ever fires twice (browser quirk under fast clicks).
      floatingTeardown?.();
      floatingTeardown = null;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "floating-action";
      // Localized via i18n key — t() resolves against the active language so
      // the button text matches the rest of the demo when RU is selected.
      btn.textContent = t("ctrl.scrim.floating.btn");
      btn.addEventListener("click", () => {
        const live = opts.getEngine();
        if (!live) return;
        // Prefer "full" for the user demo; otherwise pick the first allowed
        // snap that isn't a closed/zero-size point so the button always
        // produces visible motion.
        // Public accessor — the underlying field is private on the engine.
        const allowed = live.getAllowedIds();
        const target =
          allowed.includes("full")
            ? "full"
            : allowed.find(id => id !== "closed") ?? allowed[0];
        if (target) void live.snapTo(target);
      });
      floatingTeardown = engine.setScrimOverlay({
        children: btn,
        position: "top-right",
        interactive: true,
      });
    } else {
      floatingTeardown?.();
      floatingTeardown = null;
    }
  });

  applyPreset();
};
