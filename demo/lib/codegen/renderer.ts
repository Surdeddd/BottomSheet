import type { DemoSettings } from "../../apps/shared";

const SOURCE = "@surdeddd/bottom-sheet/webgl";

const importOf = (lifted: boolean): string =>
  lifted
    ? `import { contentLift, webglRenderer } from "${SOURCE}";`
    : `import { webglRenderer } from "${SOURCE}";`;

type Line = (call: string, load: string) => string[];

const jsx: Line = (call, load) => [
  "// WebGL renderer: one import and one more prop on the sheet above",
  load,
  `<BottomSheet features={[${call}]} />`,
];

const USAGE: Record<string, Line> = {
  react: jsx,
  solid: jsx,
  svelte: (call, load) => [
    "<!-- WebGL renderer: one import and one more prop on the sheet above -->",
    load,
    `<BottomSheet features={[${call}]} />`,
  ],
  vue: (call, load) => [
    "<!-- WebGL renderer: one import and one more prop on the sheet above -->",
    load,
    `<BottomSheet :features="[${call}]" />`,
  ],
  lit: (call, load) => [
    "// WebGL renderer: one import and one property on the element above",
    load,
    "html`<bottom-sheet .options=${{ features: [" + call + "] }}></bottom-sheet>`",
  ],
  element: (call, load) => [
    "<!-- WebGL renderer: one import and one property on the element above -->",
    '<script type="module">',
    `  ${load}`,
    `  document.querySelector("bottom-sheet").options = { features: [${call}] };`,
    "</script>",
  ],
  vanilla: (call, load) => [
    "// WebGL renderer: one import and one more option on the engine above",
    load,
    `new BottomSheetEngine({ features: [${call}] });`,
  ],
};

export const rendererSnippet = (adapter: string, s: DemoSettings): string => {
  const usage = USAGE[adapter];
  if (!s.webgl || !usage) return "";
  const given = [
    s.webglLift ? "lift: contentLift()" : "",
    s.webglOnCpu ? "allowSoftware: true" : "",
  ].filter(Boolean);
  const call = given.length
    ? `webglRenderer({ ${given.join(", ")} })`
    : "webglRenderer()";
  return usage(call, importOf(s.webglLift)).join("\n");
};
