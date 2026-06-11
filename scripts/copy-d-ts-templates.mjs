import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pairs = [
  ["src/vue/index.d.ts.template", "dist/vue.d.ts"],
  ["src/svelte/index.d.ts.template", "dist/svelte.d.ts"],
];

for (const [src, dst] of pairs) {
  const srcPath = resolve(root, src);
  if (!existsSync(srcPath)) {
    console.error(`✗ template missing: ${src}`);
    process.exitCode = 1;
    continue;
  }
  const template = readFileSync(srcPath, "utf8");
  writeFileSync(resolve(root, dst), template);
  console.log(`✓ ${dst}`);
  const cts = dst.replace(/\.d\.ts$/, ".d.cts");
  writeFileSync(
    resolve(root, cts),
    template.replaceAll('from "./index.js"', 'from "./index.cjs"'),
  );
  console.log(`✓ ${cts}`);
}

import { mkdirSync } from "node:fs";

const svelteSrcDir = resolve(root, "dist/svelte-src");
mkdirSync(svelteSrcDir, { recursive: true });
const sfc = readFileSync(resolve(root, "src/svelte/BottomSheet.svelte"), "utf8")
  .replaceAll('from "../core/BottomSheetEngine"', 'from "@surdeddd/bottom-sheet"')
  .replaceAll('from "../core/types"', 'from "@surdeddd/bottom-sheet"');
writeFileSync(resolve(svelteSrcDir, "BottomSheet.svelte"), sfc);
writeFileSync(
  resolve(svelteSrcDir, "index.js"),
  'export { default as BottomSheet } from "./BottomSheet.svelte";\nexport { createBottomSheet } from "../svelte-core.js";\n',
);
console.log("✓ dist/svelte-src (svelte export condition source)");
