
export type AdapterKey =
  | "react"
  | "vue"
  | "svelte"
  | "solid"
  | "lit"
  | "element"
  | "vanilla";

export const ADAPTERS: AdapterKey[] = [
  "react",
  "vue",
  "svelte",
  "solid",
  "lit",
  "element",
  "vanilla",
];

export type ScrimPresetKey =
  | "off"
  | "subtle"
  | "standard"
  | "monitoring"
  | "cinematic";

export type Settings = {
  mode: "bottom" | "top" | "left" | "right" | "overlay";
  initial: string;
  stiffness: number;
  damping: number;
  focusTrap: boolean;
  closeOnEscape: boolean;
  haptic: boolean;
  rubberBand: boolean;
  scrimPreset: ScrimPresetKey;
  scrimAboveSheet: boolean;
  scrimTapToClose: boolean;
  scrimFloatingAction: boolean;
};

export type ThemePreset = "default" | "ios" | "material" | "vercel";
export type Theme = "light" | "dark";
export type Lang = "en" | "ru";

export const $ = <T extends HTMLElement = HTMLElement>(sel: string): T =>
  document.querySelector<T>(sel)!;

export const announce = (msg: string): void => {
  const el = document.querySelector<HTMLElement>("#snippet-status");
  if (!el) return;
  el.textContent = "";
  window.setTimeout(() => {
    el.textContent = msg;
  }, 50);
};
