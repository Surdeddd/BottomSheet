import type { Theme, ThemePreset } from "./types";
import { startViewTransition } from "./view-transition";

// ----- light/dark page theme (data-theme attribute) -----

export const detectTheme = (): Theme =>
  (localStorage.getItem("bs-demo-theme") as Theme | null) ??
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

let currentTheme: Theme = detectTheme();

export const getTheme = (): Theme => currentTheme;

export const applyTheme = (theme: Theme): void => {
  currentTheme = theme;
  localStorage.setItem("bs-demo-theme", theme);
  document.documentElement.dataset.theme = theme;
  document
    .getElementById("theme-light")
    ?.classList.toggle("topbar-active", theme === "light");
  document
    .getElementById("theme-dark")
    ?.classList.toggle("topbar-active", theme === "dark");
  document
    .getElementById("theme-toggle")
    ?.setAttribute("aria-label", `Theme: ${theme}. Click to switch.`);
};

let themeToggleWired = false;
export const wireThemeToggle = (): void => {
  if (themeToggleWired) return;
  themeToggleWired = true;
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    // Wrap in View Transition — the body's color/background CSS already
    // crossfades via transition; VT additionally captures the topbar +
    // device-frame so the whole page swaps coherently rather than the
    // body fading at 240ms while the device-frame just hard-cuts.
    startViewTransition(() => {
      applyTheme(currentTheme === "light" ? "dark" : "light");
    });
  });
};

// ----- bottom-sheet theme preset (ios / material / vercel / default) -----
// Loaded lazily via dynamic CSS import — only the chosen theme is fetched.

const presetLoaders: Record<
  Exclude<ThemePreset, "default">,
  () => Promise<unknown>
> = {
  ios: () => import("@surdeddd/bottom-sheet/themes/ios"),
  material: () => import("@surdeddd/bottom-sheet/themes/material"),
  vercel: () => import("@surdeddd/bottom-sheet/themes/vercel"),
};
const loadedPresets = new Set<Exclude<ThemePreset, "default">>();

let currentPreset: ThemePreset =
  (localStorage.getItem("bs-demo-theme-preset") as ThemePreset | null) ??
  "default";

export const getThemePreset = (): ThemePreset => currentPreset;

export const applyThemePreset = (preset: ThemePreset): void => {
  currentPreset = preset;
  localStorage.setItem("bs-demo-theme-preset", preset);
  // Strip any previous bs-theme-* classes from every mounted root, then
  // add the new one. .bs-root may live inside multiple shadow / light
  // hosts depending on the active adapter — querySelectorAll covers them.
  document.querySelectorAll<HTMLElement>(".bs-root").forEach(root => {
    root.classList.forEach(cls => {
      if (cls.startsWith("bs-theme-")) root.classList.remove(cls);
    });
    if (preset !== "default") root.classList.add(`bs-theme-${preset}`);
  });
  document
    .querySelectorAll<HTMLButtonElement>("#theme-chips .chip")
    .forEach(b => {
      const active = b.dataset.themePreset === preset;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  const status = document.getElementById("theme-status");
  if (status) status.textContent = preset;

  if (preset !== "default" && !loadedPresets.has(preset)) {
    loadedPresets.add(preset);
    presetLoaders[preset]().catch(err => {
      console.error(`[bs-demo] failed to load theme '${preset}'`, err);
    });
  }
};

let presetChipsWired = false;
export const wireThemePresetChips = (): void => {
  if (presetChipsWired) return;
  presetChipsWired = true;
  document
    .querySelectorAll<HTMLButtonElement>("#theme-chips .chip")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        // Theme preset swap mutates `.bs-root` classes — wrap in VT so
        // tokens (colors, radii, shadows) crossfade rather than hard-cut.
        startViewTransition(() => {
          applyThemePreset(btn.dataset.themePreset as ThemePreset);
        });
      });
    });
};
