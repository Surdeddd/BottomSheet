import "@surdeddd/bottom-sheet/element";
import { mountReactDemo, type DemoController } from "./apps/react-demo";
import { mountVueDemo } from "./apps/vue-demo";
import { mountElementDemo } from "./apps/element-demo";
import { mountVanillaDemo } from "./apps/vanilla-demo";
import { mountSvelteDemo } from "./apps/svelte-demo";
import { mountSolidDemo } from "./apps/solid-demo";
import { mountLitDemo } from "./apps/lit-demo";

import { snapPoints as resolveSnapPoints } from "./apps/shared";
import { decode, encode, writeHash } from "./lib/permalink";
import { $, type AdapterKey, type Settings } from "./lib/types";
import { applyLang, getLang, t, wireLangToggle } from "./lib/i18n";
import {
  applyTheme,
  applyThemePreset,
  getTheme,
  getThemePreset,
  wireThemePresetChips,
  wireThemeToggle,
} from "./lib/theme";
import {
  defaultSnaps,
  mountSnapEditor,
  reconcileInitialSnap,
} from "./lib/snap-editor";
import { renderCode, wireCopyButton } from "./lib/code-panel";
import { startFpsLoop } from "./lib/fps";
import { wireStressTest } from "./lib/stress";
import { startViewTransition } from "./lib/view-transition";
import { wireScrimControls } from "./lib/scrim-controls";
import { whenEngineReady, wireFloatingUi } from "./lib/floating-ui";
import { wireDragSurface } from "./lib/drag-surface";
import { initHero3D } from "./lib/hero-3d";
import { initReveal } from "./lib/reveal";
import {
  initCountUp,
  initHeroParallax,
  initScrollProgress,
} from "./lib/scroll-effects";

const defaults: Settings = {
  mode: "bottom",
  initial: "minimized",
  stiffness: 260,
  damping: 28,
  focusTrap: true,
  closeOnEscape: true,
  haptic: true,
  rubberBand: true,
  scrimPreset: "monitoring",
  scrimAboveSheet: true,
  scrimTapToClose: false,
  scrimFloatingAction: false,
};
const settings: Settings = { ...defaults };

const mounters: Record<
  AdapterKey,
  (host: HTMLElement, settings: Settings) => DemoController
> = {
  react: mountReactDemo,
  vue: mountVueDemo,
  svelte: mountSvelteDemo,
  solid: mountSolidDemo,
  lit: mountLitDemo,
  element: mountElementDemo,
  vanilla: mountVanillaDemo,
};

let activeAdapter: AdapterKey = "react";
let activeController: DemoController | null = null;
let scrimControlsSync: (() => void) | null = null;
let floatingUiSync: (() => void) | null = null;
let dragSurfaceSync: (() => void) | null = null;

const ro = {
  active: $<HTMLElement>("#ro-active"),
  progress: $<HTMLElement>("#ro-progress"),
  bar: $<HTMLElement>("#ro-bar"),
  size: $<HTMLElement>("#ro-size"),
  velocity: $<HTMLElement>("#ro-velocity"),
  flDragging: $<HTMLElement>("#fl-dragging"),
  flAnimating: $<HTMLElement>("#fl-animating"),
  flTrap: $<HTMLElement>("#fl-trap"),
  flHaptic: $<HTMLElement>("#fl-haptic"),
};

const syncHash = (): void => {
  writeHash(encode(settings, activeAdapter));
};

const renderActiveCode = (): void =>
  renderCode({ settings, getActiveAdapter: () => activeAdapter });

const mountAdapter = (key: AdapterKey): void => {
  startViewTransition(() => {
    if (activeController) {
      activeController.destroy();
      activeController = null;
    }

    document
      .querySelectorAll<HTMLElement>(".device-screen")
      .forEach(el => el.toggleAttribute("hidden", el.dataset.screen !== key));

    const host = document.querySelector<HTMLElement>(`#screen-${key}`)!;
    while (host.firstChild) host.removeChild(host.firstChild);
    activeController = mounters[key](host, settings);

    activeController.onUpdate(state => {
      ro.active.textContent = state.activeId || "—";
      document
        .querySelectorAll<HTMLButtonElement>("#snap-chips .chip")
        .forEach(b => {
          const active = b.dataset.snap === state.activeId;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", String(active));
        });
      ro.progress.textContent = state.progress.toFixed(3);
      ro.bar.style.width = `${state.progress * 100}%`;
      ro.size.textContent = `${Math.round(state.size)}`;
      ro.flDragging.classList.toggle("is-on", state.isDragging);
      ro.flAnimating.classList.toggle("is-on", state.isAnimating);
    });
    activeController.onVelocity(v => {
      ro.velocity.textContent = v.toFixed(3);
    });

    applyThemePreset(getThemePreset());
    whenEngineReady(
      () => activeController?.getEngine?.() ?? null,
      () => {
        scrimControlsSync?.();
        floatingUiSync?.();
        dragSurfaceSync?.();
      },
    );
    renderActiveCode();
    syncHash();
  });
};

document.querySelectorAll<HTMLButtonElement>(".adapter").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.adapter as AdapterKey;
    if (key === activeAdapter) return;
    activeAdapter = key;

    document.querySelectorAll<HTMLButtonElement>(".adapter").forEach(b => {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    document
      .querySelectorAll<HTMLElement>(".code")
      .forEach(c => c.toggleAttribute("hidden", c.id !== `code-${key}`));
    $<HTMLElement>("#snip-tag").textContent = key;

    mountAdapter(key);
    renderActiveCode();
  });
});

const wireChipRow = (
  rowId: string,
  onClick: (btn: HTMLButtonElement) => void,
): void => {
  document
    .querySelectorAll<HTMLButtonElement>(`#${rowId} .chip`)
    .forEach(btn => {
      btn.setAttribute(
        "aria-pressed",
        String(btn.classList.contains("is-active")),
      );
      btn.addEventListener("click", () => {
        document
          .querySelectorAll<HTMLButtonElement>(`#${rowId} .chip`)
          .forEach(b => {
            const active = b === btn;
            b.classList.toggle("is-active", active);
            b.setAttribute("aria-pressed", String(active));
          });
        onClick(btn);
      });
    });
};

wireChipRow("snap-chips", btn => activeController?.snapTo(btn.dataset.snap!));

const updateChipsForMode = (): void => {
  const snapChips = $<HTMLElement>("#snap-chips");
  while (snapChips.firstChild) snapChips.removeChild(snapChips.firstChild);

  const make = (id: string, isActive: boolean): HTMLButtonElement => {
    const b = document.createElement("button");
    b.className = isActive ? "chip is-active" : "chip";
    b.dataset.snap = id;
    b.textContent = id;
    b.type = "button";
    b.setAttribute("aria-pressed", String(isActive));
    b.addEventListener("click", () => {
      snapChips
        .querySelectorAll<HTMLButtonElement>(".chip")
        .forEach(x => {
          const active = x === b;
          x.classList.toggle("is-active", active);
          x.setAttribute("aria-pressed", String(active));
        });
      activeController?.snapTo(id);
    });
    return b;
  };

  if (settings.mode === "overlay") {
    snapChips.append(make("open", false), make("close", false));
    return;
  }
  const custom = window.__bsCustomSnaps?.();
  const ids = custom ? custom.map(s => s.id) : ["minimized", "half", "full", "closed"];
  for (const id of ids) {
    snapChips.append(make(id, id === settings.initial));
  }
};

wireChipRow("mode-chips", btn => {
  settings.mode = btn.dataset.mode as Settings["mode"];
  $<HTMLElement>("#cap-mode").textContent = settings.mode;
  $<HTMLElement>("#device-frame").dataset.mode = settings.mode;
  updateChipsForMode();
  mountAdapter(activeAdapter);
});

const slStiff = $<HTMLInputElement>("#sl-stiff");
const slDamp = $<HTMLInputElement>("#sl-damp");
const lblStiff = $<HTMLElement>("#lbl-stiff");
const lblDamp = $<HTMLElement>("#lbl-damp");

let remountTimer: number | null = null;
const debouncedRemount = (): void => {
  if (remountTimer) clearTimeout(remountTimer);
  remountTimer = window.setTimeout(() => mountAdapter(activeAdapter), 220);
};
slStiff.addEventListener("input", () => {
  settings.stiffness = parseInt(slStiff.value, 10);
  lblStiff.textContent = String(settings.stiffness);
  renderActiveCode();
  syncHash();
  debouncedRemount();
});
slDamp.addEventListener("input", () => {
  settings.damping = parseInt(slDamp.value, 10);
  lblDamp.textContent = String(settings.damping);
  renderActiveCode();
  syncHash();
  debouncedRemount();
});

const tgTrap = $<HTMLInputElement>("#tg-trap");
const tgEsc = $<HTMLInputElement>("#tg-esc");
const tgHaptic = $<HTMLInputElement>("#tg-haptic");
const tgRubber = $<HTMLInputElement>("#tg-rubber");

tgTrap.addEventListener("change", () => {
  settings.focusTrap = tgTrap.checked;
  ro.flTrap.classList.toggle("is-on", settings.focusTrap);
  mountAdapter(activeAdapter);
});
tgEsc.addEventListener("change", () => {
  settings.closeOnEscape = tgEsc.checked;
  mountAdapter(activeAdapter);
});
tgHaptic.addEventListener("change", () => {
  settings.haptic = tgHaptic.checked;
  ro.flHaptic.classList.toggle("is-on", settings.haptic);
  renderActiveCode();
  syncHash();
});
tgRubber.addEventListener("change", () => {
  settings.rubberBand = tgRubber.checked;
  mountAdapter(activeAdapter);
});
ro.flTrap.classList.toggle("is-on", settings.focusTrap);
ro.flHaptic.classList.toggle("is-on", settings.haptic);

startFpsLoop();
applyLang(getLang());
applyTheme(getTheme());
applyThemePreset(getThemePreset());
wireLangToggle();
wireThemeToggle();
wireThemePresetChips();
mountSnapEditor({
  settings,
  onChange: () => mountAdapter(activeAdapter),
  onChipUpdate: updateChipsForMode,
});
wireStressTest({ getController: () => activeController });
wireCopyButton(() => activeAdapter);

const scrimControls = wireScrimControls({
  getEngine: () => activeController?.getEngine?.() ?? null,
  settings,
  onChange: () => renderActiveCode(),
});
scrimControlsSync = scrimControls.syncToEngine;

const floatingUi = wireFloatingUi({
  getEngine: () => activeController?.getEngine?.() ?? null,
});
floatingUiSync = floatingUi.syncToEngine;

const dragSurface = wireDragSurface({
  getEngine: () => activeController?.getEngine?.() ?? null,
  getScreen: () =>
    document.querySelector<HTMLElement>(
      `.device-screen[data-screen="${activeAdapter}"]`,
    ),
});
dragSurfaceSync = dragSurface.syncToEngine;

const initial = decode(location.hash);
if (initial.adapter) activeAdapter = initial.adapter;
Object.assign(settings, initial.settings);
reconcileInitialSnap(
  settings,
  resolveSnapPoints(settings.mode).map(s => ({
    id: s.id,
    size: typeof s.size === "number" ? s.size : 1,
  })),
);

slStiff.value = String(settings.stiffness);
lblStiff.textContent = String(settings.stiffness);
slDamp.value = String(settings.damping);
lblDamp.textContent = String(settings.damping);
tgTrap.checked = settings.focusTrap;
tgEsc.checked = settings.closeOnEscape;
tgHaptic.checked = settings.haptic;
tgRubber.checked = settings.rubberBand;

document.querySelectorAll<HTMLButtonElement>(".adapter").forEach(b => {
  const active = b.dataset.adapter === activeAdapter;
  b.classList.toggle("is-active", active);
  b.setAttribute("aria-pressed", String(active));
});
document
  .querySelectorAll<HTMLElement>(".code")
  .forEach(c => c.toggleAttribute("hidden", c.id !== `code-${activeAdapter}`));
const snipTag = document.querySelector<HTMLElement>("#snip-tag");
if (snipTag) snipTag.textContent = activeAdapter;

updateChipsForMode();

mountAdapter(activeAdapter);
initReveal();
initScrollProgress();
initCountUp();
initHeroParallax();

const heroStage = $<HTMLElement>("#hero-3d");
void initHero3D(heroStage).then(handle => {
  if (handle) heroStage.classList.add("is-live");
});

$<HTMLButtonElement>("#install-copy")?.addEventListener("click", async () => {
  const label = $<HTMLElement>("#install-copy-label");
  try {
    await navigator.clipboard.writeText("npm i @surdeddd/bottom-sheet");
    if (label) label.textContent = t("install.copied");
  } catch {
    if (label) label.textContent = "failed";
  }
  window.setTimeout(() => {
    if (label) label.textContent = t("install.copy");
  }, 1400);
});

export { defaultSnaps };
