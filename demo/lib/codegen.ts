// Public entry point for the demo's per-adapter snippet generator. The
// implementation lives in `./codegen/`:
//
//   - `./codegen/shared`    — formatting / behaviour helpers used by every
//                              generator
//   - `./codegen/adapters`  — eight per-adapter snippet generators
//   - `./codegen/tokenize`  — CSP-friendly syntax classifier (the demo's
//                              code-panel paints DOM via createElement, so
//                              this stays an HTML-free token list)
//
// Re-exports preserve the historic call-site shape: `import { genCode,
// tokenize, type Token, type AdapterKey } from "./codegen"` continues to
// work after the split.

import type { DemoSettings } from "../apps/shared";
import {
  genElement,
  genLit,
  genQwik,
  genReact,
  genSolid,
  genSvelte,
  genVanilla,
  genVue,
} from "./codegen/adapters";
import type { GenOptions, SnapPoint } from "./codegen/shared";

// Re-export AdapterKey from the demo-wide single source of truth so existing
// `import type { AdapterKey } from "./codegen"` call sites stay unchanged.
export type { AdapterKey } from "./types";
export type { GenOptions, SnapPoint } from "./codegen/shared";
export { SNIPPET_DEFAULTS } from "./codegen/shared";
export {
  genElement,
  genLit,
  genQwik,
  genReact,
  genSolid,
  genSvelte,
  genVanilla,
  genVue,
} from "./codegen/adapters";
export { tokenize, type Token } from "./codegen/tokenize";

// `qwik` was supported in earlier codegen variants — kept as an internal
// enumeration so the dispatch table below stays exhaustive even though no
// demo UI tab references it. The exported `AdapterKey` intentionally
// excludes qwik to match the demo's adapter switcher.
type CodegenAdapter =
  | "react"
  | "vue"
  | "svelte"
  | "solid"
  | "qwik"
  | "lit"
  | "element"
  | "vanilla";

const generators: Record<
  CodegenAdapter,
  (s: DemoSettings, snaps: SnapPoint[], opts?: GenOptions) => string
> = {
  react: genReact,
  vue: genVue,
  svelte: genSvelte,
  solid: genSolid,
  qwik: genQwik,
  lit: genLit,
  element: genElement,
  vanilla: genVanilla,
};

export function genCode(
  adapter: CodegenAdapter,
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const fn = generators[adapter] ?? genReact;
  return fn(settings, snaps, opts);
}
