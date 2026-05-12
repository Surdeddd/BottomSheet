
import type { DemoSettings } from "../../apps/shared";
import type { ScrimPresetKey } from "../types";

export const SCRIM_PRESET_PAYLOADS: Record<
  ScrimPresetKey,
  { color: string; blur: string | null }
> = {
  off:        { color: "rgba(0,0,0,0)",          blur: null },
  subtle:     { color: "rgba(0, 0, 0, 0.2)",     blur: null },
  standard:   { color: "rgba(0, 0, 0, 0.4)",     blur: null },
  monitoring: { color: "rgba(15, 15, 20, 0.55)", blur: "4px" },
  cinematic:  { color: "rgba(0, 0, 0, 0.7)",     blur: "12px" },
};

export type SnapPoint = { id: string; size: number | string };

export type GenOptions = {
  compact?: boolean;
};

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

export const scrimSnippetReact = (
  s: DemoSettings,
  compact: boolean,
): string => {
  if (
    compact &&
    s.scrimPreset === "monitoring" &&
    s.scrimAboveSheet &&
    !s.scrimTapToClose &&
    s.scrimFloatingAction
  )
    return "";
  const p = SCRIM_PRESET_PAYLOADS[s.scrimPreset];
  const lines: string[] = [
    `// Tune scrim at runtime via the engine handle:`,
    `useEffect(() => {`,
    `  const engine = ref.current?.getEngine();`,
  ];
  if (s.scrimPreset === "off") {
    lines.push(`  engine?.setScrimEnabled(false);`);
    lines.push(`  engine?.setScrimMode("off");`);
  } else {
    const blurField = p.blur ? `, blur: "${p.blur}"` : "";
    lines.push(`  engine?.setScrimEnabled(true);`);
    lines.push(
      `  engine?.setScrimMode("${s.scrimAboveSheet ? "above-sheet" : "full"}");`,
    );
    lines.push(`  engine?.setScrim({ color: "${p.color}"${blurField} });`);
  }
  if (s.scrimTapToClose) lines.push(`  engine?.setScrimTapToClose(true);`);
  if (s.scrimFloatingAction) {
    lines.push(`  engine?.setScrimOverlay({`);
    lines.push(`    children: yourFab,`);
    lines.push(`    position: "sheet-top-right",`);
    lines.push(`    interactive: true,`);
    lines.push(`  });`);
  }
  lines.push(`}, []);`);
  return lines.join("\n");
};


const scrimIsDefault = (s: DemoSettings): boolean =>
  s.scrimPreset === "monitoring" &&
  s.scrimAboveSheet &&
  !s.scrimTapToClose &&
  s.scrimFloatingAction;

const scrimEngineBody = (
  s: DemoSettings,
  eng: string,
  indent: string,
): string[] => {
  const p = SCRIM_PRESET_PAYLOADS[s.scrimPreset];
  const lines: string[] = [];
  if (s.scrimPreset === "off") {
    lines.push(`${indent}${eng}.setScrimEnabled(false);`);
    lines.push(`${indent}${eng}.setScrimMode("off");`);
  } else {
    const blurField = p.blur ? `, blur: "${p.blur}"` : "";
    lines.push(`${indent}${eng}.setScrimEnabled(true);`);
    lines.push(
      `${indent}${eng}.setScrimMode("${s.scrimAboveSheet ? "above-sheet" : "full"}");`,
    );
    lines.push(`${indent}${eng}.setScrim({ color: "${p.color}"${blurField} });`);
  }
  if (s.scrimTapToClose) lines.push(`${indent}${eng}.setScrimTapToClose(true);`);
  if (s.scrimFloatingAction) {
    lines.push(`${indent}${eng}.setScrimOverlay({`);
    lines.push(`${indent}  children: yourFab,`);
    lines.push(`${indent}  position: "sheet-top-right",`);
    lines.push(`${indent}  interactive: true,`);
    lines.push(`${indent}});`);
  }
  return lines;
};

export const scrimSnippetVue = (
  s: DemoSettings,
  compact: boolean,
): string => {
  if (compact && scrimIsDefault(s)) return "";
  const out: string[] = [
    `<!-- Tune scrim at runtime via the engine handle: -->`,
    `<script setup lang="ts">`,
    `import { ref, onMounted } from "vue";`,
    `const bsRef = ref<InstanceType<typeof BottomSheet>>();`,
    `onMounted(() => {`,
    `  const engine = bsRef.value?.getEngine?.();`,
    ...scrimEngineBody(s, "engine?", "  "),
    `});`,
    `</script>`,
  ];
  return out.join("\n");
};

export const scrimSnippetSvelte = (
  s: DemoSettings,
  compact: boolean,
): string => {
  if (compact && scrimIsDefault(s)) return "";
  const out: string[] = [
    `<!-- Tune scrim at runtime via the engine handle: -->`,
    `<script lang="ts">`,
    `let bsRef: ReturnType<typeof BottomSheet> | undefined = $state();`,
    `$effect(() => {`,
    `  const engine = bsRef?.getEngine?.();`,
    ...scrimEngineBody(s, "engine?", "  "),
    `});`,
    `</script>`,
  ];
  return out.join("\n");
};

export const scrimSnippetSolid = (
  s: DemoSettings,
  compact: boolean,
): string => {
  if (compact && scrimIsDefault(s)) return "";
  const out: string[] = [
    `// Wire scrim via the engineRef callback on <BottomSheet>:`,
    `<BottomSheet`,
    `  engineRef={(engine) => {`,
    ...scrimEngineBody(s, "engine?", "    "),
    `  }}`,
    `/>`,
  ];
  return out.join("\n");
};

export const scrimSnippetQwik = (
  s: DemoSettings,
  compact: boolean,
): string => {
  if (compact && scrimIsDefault(s)) return "";
  const out: string[] = [
    `// Tune scrim at runtime via the engine handle:`,
    `import { useSignal, useVisibleTask$ } from "@builder.io/qwik";`,
    `const bsRef = useSignal<HTMLElement>();`,
    `useVisibleTask$(({ track }) => {`,
    `  track(() => bsRef.value);`,
    `  const engine = (bsRef.value as any)?.getEngine?.();`,
    ...scrimEngineBody(s, "engine?", "  "),
    `});`,
  ];
  return out.join("\n");
};

export const scrimSnippetLit = (
  s: DemoSettings,
  compact: boolean,
): string => {
  if (compact && scrimIsDefault(s)) return "";
  const out: string[] = [
    `// Tune scrim at runtime — query the registered custom element:`,
    `firstUpdated() {`,
    `  const el = this.shadowRoot?.querySelector("bottom-sheet") as any;`,
    `  const engine = el?.getEngine?.();`,
    ...scrimEngineBody(s, "engine?", "  "),
    `}`,
  ];
  return out.join("\n");
};

export const scrimSnippetElement = (
  s: DemoSettings,
  compact: boolean,
): string => {
  if (compact && scrimIsDefault(s)) return "";
  const out: string[] = [
    `<!-- Tune scrim at runtime via the engine handle: -->`,
    `<script type="module">`,
    `  const engine = document.querySelector("bottom-sheet")?.getEngine?.();`,
    ...scrimEngineBody(s, "engine?", "  "),
    `</script>`,
  ];
  return out.join("\n");
};

export const scrimSnippetVanilla = (
  s: DemoSettings,
  compact: boolean,
): string => {
  if (compact && scrimIsDefault(s)) return "";
  const out: string[] = [
    `// Tune scrim at runtime — engine is already in scope:`,
    ...scrimEngineBody(s, "engine", ""),
  ];
  return out.join("\n");
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
