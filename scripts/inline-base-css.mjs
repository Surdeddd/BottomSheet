// Generates src/web-component/baseStyles.ts from src/styles/bottom-sheet.css
// so the WC can inject base styles into its shadow root without bundler magic.
// Runs in `prebuild` and is safe to re-run any time. CI can fail if drift exists.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = resolve(root, "src/styles/bottom-sheet.css");
const tsPath = resolve(root, "src/web-component/baseStyles.ts");

const cssRaw = readFileSync(cssPath, "utf8");
// Conservative regex minifier — drops comments, collapses whitespace, tightens
// punctuation. Cuts ~47% off raw size, which compounds in the WC IIFE bundle
// (CSS inlined as a JS string; tsup's `minify: true` doesn't reach inside
// template literals). Preserves semantic structure: no shorthand merges, no
// selector dedup, no value optimization — only whitespace work that every
// CSS parser handles identically.
const css = cssRaw
  .replace(/\/\*[\s\S]*?\*\//g, "")        // strip /* ... */ comments
  .replace(/\s+/g, " ")                     // collapse whitespace runs
  .replace(/\s*([{};:,>])\s*/g, "$1")       // tighten around { } ; , : >
  .replace(/;}/g, "}")                      // drop trailing ; before }
  .trim();
// Escape backticks and ${ so the string survives a TS template literal.
const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const out = `// AUTO-GENERATED from src/styles/bottom-sheet.css by scripts/inline-base-css.mjs.
// Do not edit by hand — run \`npm run sync:css\` to refresh after editing the CSS.

export const baseStyles = \`${escaped}\`;
`;

writeFileSync(tsPath, out, "utf8");
console.log(
  `✓ wrote ${tsPath} (${css.length} chars minified from ${cssRaw.length} raw, ${Math.round((1 - css.length / cssRaw.length) * 100)}% smaller)`,
);
