// Shared type definitions for the demo. Single source of truth — keeps
// `AdapterKey`, `Settings`, and the i18n/theme enums consistent across
// `main.ts`, `permalink.ts`, `codegen.ts`, and the per-feature modules.

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

export type Settings = {
  mode: "bottom" | "top" | "left" | "right" | "overlay";
  initial: string;
  stiffness: number;
  damping: number;
  focusTrap: boolean;
  closeOnEscape: boolean;
  haptic: boolean;
  rubberBand: boolean;
};

export type ThemePreset = "default" | "ios" | "material" | "vercel";
export type Theme = "light" | "dark";
export type Lang = "en" | "ru";

// Tiny `$` helper used throughout the demo. Throws if the selector misses —
// every call site assumes the static template element exists, so a missing
// node is a bug we want to surface loudly.
export const $ = <T extends HTMLElement = HTMLElement>(sel: string): T =>
  document.querySelector<T>(sel)!;

// Toggling textContent forces aria-live polite to re-announce even when
// the same message fires twice in a row (some screen readers dedupe).
export const announce = (msg: string): void => {
  const el = document.querySelector<HTMLElement>("#snippet-status");
  if (!el) return;
  el.textContent = "";
  window.setTimeout(() => {
    el.textContent = msg;
  }, 50);
};
