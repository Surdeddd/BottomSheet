import type { DemoSettings } from "../../apps/shared";

const IMPORT = 'import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";';

const jsx = (call: string): string[] => [
  "// WebGL renderer: one import and one more prop on the sheet above",
  IMPORT,
  `<BottomSheet features={[${call}]} />`,
];

const USAGE: Record<string, (call: string) => string[]> = {
  react: jsx,
  solid: jsx,
  svelte: call => [
    "<!-- WebGL renderer: one import and one more prop on the sheet above -->",
    IMPORT,
    `<BottomSheet features={[${call}]} />`,
  ],
  vue: call => [
    "<!-- WebGL renderer: one import and one more prop on the sheet above -->",
    IMPORT,
    `<BottomSheet :features="[${call}]" />`,
  ],
  lit: call => [
    "// WebGL renderer: one import and one property on the element above",
    IMPORT,
    "html`<bottom-sheet .options=${{ features: [" + call + "] }}></bottom-sheet>`",
  ],
  element: call => [
    "<!-- WebGL renderer: one import and one property on the element above -->",
    '<script type="module">',
    `  ${IMPORT}`,
    `  document.querySelector("bottom-sheet").options = { features: [${call}] };`,
    "</script>",
  ],
  vanilla: call => [
    "// WebGL renderer: one import and one more option on the engine above",
    IMPORT,
    `new BottomSheetEngine({ features: [${call}] });`,
  ],
};

export const rendererSnippet = (adapter: string, s: DemoSettings): string => {
  const usage = USAGE[adapter];
  if (!s.webgl || !usage) return "";
  return usage(
    s.webglOnCpu ? "webglRenderer({ allowSoftware: true })" : "webglRenderer()",
  ).join("\n");
};
