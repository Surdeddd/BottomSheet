// Copies hand-written d.ts templates for SFC subpaths (vue, svelte) into dist/.
// tsup's onSuccess hook ran the same copies, but dts emission can race with it
// and the templates would silently disappear from dist/. Running this as a
// postbuild step (after tsup fully exits) is deterministic.

import { copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pairs = [
  ["src/vue/index.d.ts.template", "dist/vue.d.ts"],
  ["src/svelte/index.d.ts.template", "dist/svelte.d.ts"],
];

for (const [src, dst] of pairs) {
  const srcPath = resolve(root, src);
  const dstPath = resolve(root, dst);
  if (!existsSync(srcPath)) {
    console.error(`✗ template missing: ${src}`);
    process.exitCode = 1;
    continue;
  }
  copyFileSync(srcPath, dstPath);
  console.log(`✓ ${dst}`);
}
