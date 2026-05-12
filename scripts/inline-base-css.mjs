import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = resolve(root, "src/styles/bottom-sheet.css");
const tsPath = resolve(root, "src/web-component/baseStyles.ts");

const cssRaw = readFileSync(cssPath, "utf8");
const css = cssRaw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{};:,>])\s*/g, "$1")
  .replace(/;}/g, "}")
  .trim();
const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const out = `export const baseStyles = \`${escaped}\`;\n`;

writeFileSync(tsPath, out, "utf8");
console.log(
  `✓ wrote ${tsPath} (${css.length} chars minified from ${cssRaw.length} raw, ${Math.round((1 - css.length / cssRaw.length) * 100)}% smaller)`,
);
