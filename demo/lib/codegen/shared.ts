// Shared formatting / behaviour helpers used by every per-adapter generator.
// Kept here to avoid duplicating the same skip/format logic across eight files.

import type { DemoSettings } from "../../apps/shared";

export type SnapPoint = { id: string; size: number | string };

export type GenOptions = {
  // Hide lines that match SNIPPET_DEFAULTS — so the snippet shows only what
  // the user has actually tweaked away from the demo's starting point.
  compact?: boolean;
};

// Defaults the generated snippet treats as "uninteresting" in compact mode —
// keep them in sync with `defaults` in demo/main.ts so a freshly-loaded demo
// generates the absolute minimum snippet.
export const SNIPPET_DEFAULTS = {
  stiffness: 260,
  damping: 28,
  focusTrap: true,
  closeOnEscape: true,
  rubberBand: true,
  haptic: true,
  initial: "minimized",
  mode: "bottom" as DemoSettings["mode"],
};

export const fmtSize = (size: number | string): string =>
  typeof size === "number" ? String(size) : `"${size}"`;

export const snapsToInline = (snaps: SnapPoint[]): string =>
  snaps
    .map(s => `    { id: "${s.id}", size: ${fmtSize(s.size)} }`)
    .join(",\n");

export const jsonInline = (snaps: SnapPoint[]): string =>
  JSON.stringify(snaps.map(s => ({ id: s.id, size: s.size })));

// In compact mode skip a behaviour prop when its value equals the default —
// the engine applies the default itself if the prop is omitted.
export const skipBehavior = (
  flag: boolean,
  defaultVal: boolean,
  compact: boolean,
): boolean => compact && flag === defaultVal;

export const skipNum = (val: number, def: number, compact: boolean): boolean =>
  compact && val === def;

export const skipStr = (val: string, def: string, compact: boolean): boolean =>
  compact && val === def;

export const optLine = (line: string, skip: boolean): string =>
  skip ? "" : line + "\n";

// Collapse runs of consecutive blank lines that show up after `optLine` skips
// — the snippet stays tidy regardless of how many lines the compact mode
// trimmed away.
export const dropEmpty = (s: string): string => s.replace(/\n\n+/g, "\n");

export const behaviorPropsReact = (
  s: DemoSettings,
  compact: boolean,
): string => {
  const lines: string[] = [];
  if (
    s.focusTrap &&
    !skipBehavior(s.focusTrap, SNIPPET_DEFAULTS.focusTrap, compact)
  ) {
    lines.push("  focusTrap");
  }
  if (
    s.closeOnEscape &&
    !skipBehavior(s.closeOnEscape, SNIPPET_DEFAULTS.closeOnEscape, compact)
  ) {
    lines.push("  closeOnEscape");
  }
  if (
    s.rubberBand &&
    !skipBehavior(s.rubberBand, SNIPPET_DEFAULTS.rubberBand, compact)
  ) {
    lines.push("  rubberBand");
  }
  return lines.join("\n");
};

export const behaviorPropsKebab = (
  s: DemoSettings,
  compact: boolean,
): string => {
  const lines: string[] = [];
  if (
    s.focusTrap &&
    !skipBehavior(s.focusTrap, SNIPPET_DEFAULTS.focusTrap, compact)
  ) {
    lines.push('  focus-trap="true"');
  }
  if (
    s.closeOnEscape &&
    !skipBehavior(s.closeOnEscape, SNIPPET_DEFAULTS.closeOnEscape, compact)
  ) {
    lines.push('  close-on-escape="true"');
  }
  if (
    s.rubberBand &&
    !skipBehavior(s.rubberBand, SNIPPET_DEFAULTS.rubberBand, compact)
  ) {
    lines.push('  rubber-band="true"');
  }
  return lines.join("\n");
};
