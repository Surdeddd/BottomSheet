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
import { genOverlayEngine, genOverlayReact } from "./codegen/overlay";
import { rendererSnippet } from "./codegen/renderer";
import type { GenOptions, SnapPoint } from "./codegen/shared";

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
  if (settings.mode === "overlay") {
    return adapter === "react"
      ? genOverlayReact(settings)
      : genOverlayEngine(settings);
  }
  const fn = generators[adapter] ?? genReact;
  const code = fn(settings, snaps, opts);
  const renderer = rendererSnippet(adapter, settings);
  return renderer ? code + "\n\n" + renderer : code;
}
