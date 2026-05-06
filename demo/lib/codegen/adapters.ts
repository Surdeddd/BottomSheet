// Per-adapter snippet generators. Each `gen*` builds a self-contained code
// snippet from current `DemoSettings` + the active snap-points list. The
// shared formatting helpers in `./shared` keep the eight outputs consistent.

import type { DemoSettings } from "../../apps/shared";
import {
  SNIPPET_DEFAULTS,
  behaviorPropsKebab,
  behaviorPropsReact,
  dropEmpty,
  jsonInline,
  optLine,
  skipBehavior,
  skipNum,
  skipStr,
  snapsToInline,
  type GenOptions,
  type SnapPoint,
} from "./shared";

export function genReact(
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const c = !!opts.compact;
  const beh = behaviorPropsReact(settings, c);
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  const springSkip =
    skipNum(settings.stiffness, SNIPPET_DEFAULTS.stiffness, c) &&
    skipNum(settings.damping, SNIPPET_DEFAULTS.damping, c);
  return dropEmpty(`// React
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

<BottomSheet
  snapPoints={[
${snapsToInline(snaps)},
  ]}
${optLine(`  initial="${settings.initial}"`, skipStr(settings.initial, SNIPPET_DEFAULTS.initial, c))}${optLine(`  mode="${mode}"`, skipStr(mode, SNIPPET_DEFAULTS.mode, c))}  animation="spring"
${optLine(`  spring={{ stiffness: ${settings.stiffness}, damping: ${settings.damping} }}`, springSkip)}${beh ? beh + "\n" : ""}>
  <YourList />
</BottomSheet>`);
}

export function genVue(
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const c = !!opts.compact;
  const beh: string[] = [];
  if (settings.focusTrap && !skipBehavior(settings.focusTrap, SNIPPET_DEFAULTS.focusTrap, c))
    beh.push("    focus-trap");
  if (settings.closeOnEscape && !skipBehavior(settings.closeOnEscape, SNIPPET_DEFAULTS.closeOnEscape, c))
    beh.push("    close-on-escape");
  if (settings.rubberBand && !skipBehavior(settings.rubberBand, SNIPPET_DEFAULTS.rubberBand, c))
    beh.push("    rubber-band");
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  const springSkip =
    skipNum(settings.stiffness, SNIPPET_DEFAULTS.stiffness, c) &&
    skipNum(settings.damping, SNIPPET_DEFAULTS.damping, c);
  return dropEmpty(`<!-- Vue 3 -->
<script setup>
import { BottomSheet } from "@surdeddd/bottom-sheet/vue";
import "@surdeddd/bottom-sheet/styles";
</script>

<template>
  <BottomSheet
    :snap-points='${jsonInline(snaps)}'
${optLine(`    initial="${settings.initial}"`, skipStr(settings.initial, SNIPPET_DEFAULTS.initial, c))}${optLine(`    mode="${mode}"`, skipStr(mode, SNIPPET_DEFAULTS.mode, c))}    animation="spring"
${optLine(`    :spring="{ stiffness: ${settings.stiffness}, damping: ${settings.damping} }"`, springSkip)}${beh.length ? beh.join("\n") + "\n" : ""}    @snap="onSnap"
  >
    <YourList />
  </BottomSheet>
</template>`);
}

export function genSvelte(
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const c = !!opts.compact;
  const beh: string[] = [];
  if (settings.focusTrap && !skipBehavior(settings.focusTrap, SNIPPET_DEFAULTS.focusTrap, c))
    beh.push("  focusTrap");
  if (settings.closeOnEscape && !skipBehavior(settings.closeOnEscape, SNIPPET_DEFAULTS.closeOnEscape, c))
    beh.push("  closeOnEscape");
  if (settings.rubberBand && !skipBehavior(settings.rubberBand, SNIPPET_DEFAULTS.rubberBand, c))
    beh.push("  rubberBand");
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  const springSkip =
    skipNum(settings.stiffness, SNIPPET_DEFAULTS.stiffness, c) &&
    skipNum(settings.damping, SNIPPET_DEFAULTS.damping, c);
  return dropEmpty(`<!-- Svelte 5 — runes + SFC -->
<script lang="ts">
import { BottomSheet } from "@surdeddd/bottom-sheet/svelte";
import "@surdeddd/bottom-sheet/styles";
let sheet: any = $state();
</script>

<BottomSheet
  bind:this={sheet}
  snapPoints={[
${snapsToInline(snaps)},
  ]}
${optLine(`  initial="${settings.initial}"`, skipStr(settings.initial, SNIPPET_DEFAULTS.initial, c))}${optLine(`  mode="${mode}"`, skipStr(mode, SNIPPET_DEFAULTS.mode, c))}  animation="spring"
${optLine(`  spring={{ stiffness: ${settings.stiffness}, damping: ${settings.damping} }}`, springSkip)}${beh.length ? beh.join("\n") + "\n" : ""}  onsnap={(id) => console.log(id)}
>
  <YourList />
</BottomSheet>`);
}

export function genSolid(
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const c = !!opts.compact;
  const beh = behaviorPropsReact(settings, c);
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  const springSkip =
    skipNum(settings.stiffness, SNIPPET_DEFAULTS.stiffness, c) &&
    skipNum(settings.damping, SNIPPET_DEFAULTS.damping, c);
  return dropEmpty(`// Solid
import { BottomSheet } from "@surdeddd/bottom-sheet/solid";
import "@surdeddd/bottom-sheet/styles";

<BottomSheet
  snapPoints={[
${snapsToInline(snaps)},
  ]}
${optLine(`  initial="${settings.initial}"`, skipStr(settings.initial, SNIPPET_DEFAULTS.initial, c))}${optLine(`  mode="${mode}"`, skipStr(mode, SNIPPET_DEFAULTS.mode, c))}  animation="spring"
${optLine(`  spring={{ stiffness: ${settings.stiffness}, damping: ${settings.damping} }}`, springSkip)}${beh ? beh + "\n" : ""}  onSnap={(id) => console.log(id)}
>
  <YourList />
</BottomSheet>`);
}

export function genQwik(
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const c = !!opts.compact;
  const beh: string[] = [];
  if (settings.focusTrap && !skipBehavior(settings.focusTrap, SNIPPET_DEFAULTS.focusTrap, c))
    beh.push("    focusTrap");
  if (settings.closeOnEscape && !skipBehavior(settings.closeOnEscape, SNIPPET_DEFAULTS.closeOnEscape, c))
    beh.push("    closeOnEscape");
  if (settings.rubberBand && !skipBehavior(settings.rubberBand, SNIPPET_DEFAULTS.rubberBand, c))
    beh.push("    rubberBand");
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  const springSkip =
    skipNum(settings.stiffness, SNIPPET_DEFAULTS.stiffness, c) &&
    skipNum(settings.damping, SNIPPET_DEFAULTS.damping, c);
  return dropEmpty(`// Qwik
import { component$, $ } from "@builder.io/qwik";
import { BottomSheet } from "@surdeddd/bottom-sheet/qwik";
import "@surdeddd/bottom-sheet/styles";

export default component$(() => (
  <BottomSheet
    snapPoints={[
${snapsToInline(snaps)},
    ]}
${optLine(`    initial="${settings.initial}"`, skipStr(settings.initial, SNIPPET_DEFAULTS.initial, c))}${optLine(`    mode="${mode}"`, skipStr(mode, SNIPPET_DEFAULTS.mode, c))}    animation="spring"
${optLine(`    spring={{ stiffness: ${settings.stiffness}, damping: ${settings.damping} }}`, springSkip)}${beh.length ? beh.join("\n") + "\n" : ""}    onSnap$={$((id: string) => console.log(id))}
  >
    <YourList />
  </BottomSheet>
));`);
}

export function genLit(
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const beh = behaviorPropsKebab(settings, !!opts.compact);
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  return dropEmpty(`// Lit — wraps the <bottom-sheet> custom element
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import "@surdeddd/bottom-sheet/element";

@customElement("my-sheet")
class MySheet extends LitElement {
  createRenderRoot() { return this; }
  render() {
    return html\`
      <bottom-sheet
        snap-points='${jsonInline(snaps)}'
${optLine(`        initial="${settings.initial}"`, skipStr(settings.initial, SNIPPET_DEFAULTS.initial, !!opts.compact))}${optLine(`        mode="${mode}"`, skipStr(mode, SNIPPET_DEFAULTS.mode, !!opts.compact))}        animation="spring"
${beh
  .split("\n")
  .filter(Boolean)
  .map(l => "    " + l)
  .join("\n")}${beh ? "\n" : ""}      >
        <h2 slot="header">Title</h2>
        <ul>…</ul>
      </bottom-sheet>
    \`;
  }
}`);
}

export function genElement(
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const beh = behaviorPropsKebab(settings, !!opts.compact);
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  return dropEmpty(`<!-- Web Component -->
<link rel="stylesheet" href="/styles.css">
<script type="module" src="/element.js"></script>

<bottom-sheet
  snap-points='${jsonInline(snaps)}'
${optLine(`  initial="${settings.initial}"`, skipStr(settings.initial, SNIPPET_DEFAULTS.initial, !!opts.compact))}${optLine(`  mode="${mode}"`, skipStr(mode, SNIPPET_DEFAULTS.mode, !!opts.compact))}  animation="spring"
${beh}${beh ? "\n" : ""}>
  <h2 slot="header">Title</h2>
  <ul>…</ul>
</bottom-sheet>`);
}

export function genVanilla(
  settings: DemoSettings,
  snaps: SnapPoint[],
  opts: GenOptions = {},
): string {
  const c = !!opts.compact;
  const mode = settings.mode === "overlay" ? "bottom" : settings.mode;
  return dropEmpty(`// Vanilla — engine wired to plain DOM
import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

const engine = new BottomSheetEngine({
  element:         document.querySelector(".bs-sheet"),
  handle:          document.querySelector(".bs-handle"),
  scrollContainer: document.querySelector(".bs-content"),
  backdrop:        document.querySelector(".bs-backdrop"),
  snapPoints: [
${snapsToInline(snaps)},
  ],
${optLine(`  initial: "${settings.initial}",`, skipStr(settings.initial, SNIPPET_DEFAULTS.initial, c))}${optLine(`  mode: "${mode}",`, skipStr(mode, SNIPPET_DEFAULTS.mode, c))}  animation: "spring",
${optLine(`  spring: { stiffness: ${settings.stiffness}, damping: ${settings.damping} },`, skipNum(settings.stiffness, SNIPPET_DEFAULTS.stiffness, c) && skipNum(settings.damping, SNIPPET_DEFAULTS.damping, c))}${optLine(`  focusTrap: ${settings.focusTrap},`, skipBehavior(settings.focusTrap, SNIPPET_DEFAULTS.focusTrap, c))}${optLine(`  closeOnEscape: ${settings.closeOnEscape},`, skipBehavior(settings.closeOnEscape, SNIPPET_DEFAULTS.closeOnEscape, c))}${optLine(`  rubberBand: ${settings.rubberBand},`, skipBehavior(settings.rubberBand, SNIPPET_DEFAULTS.rubberBand, c))}});
engine.on("snap", ({ id }) => console.log(id));
engine.snapTo("${settings.initial}");`);
}
