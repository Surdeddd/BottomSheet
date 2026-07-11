import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");

const collectMarkdown = dir => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectMarkdown(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
};

const files = [
  join(root, "README.md"),
  join(root, "CONTRIBUTING.md"),
  ...collectMarkdown(join(root, "docs")),
].filter(existsSync);

const knownScripts = new Set();
const pkgFiles = [join(root, "package.json")];
const examplesDir = join(root, "examples");
if (existsSync(examplesDir)) {
  for (const entry of readdirSync(examplesDir)) {
    const p = join(examplesDir, entry, "package.json");
    if (existsSync(p)) pkgFiles.push(p);
  }
}
for (const p of pkgFiles) {
  const pkg = JSON.parse(readFileSync(p, "utf8"));
  for (const name of Object.keys(pkg.scripts ?? {})) knownScripts.add(name);
}

const errors = [];

const SCRIPT_RE = /npm run ([a-zA-Z0-9:_-]+)/g;
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = file.slice(root.length + 1);

  for (const m of text.matchAll(SCRIPT_RE)) {
    const name = m[1];
    if (!knownScripts.has(name)) {
      errors.push(`${rel}: references non-existent npm script "npm run ${name}"`);
    }
  }

  for (const m of text.matchAll(LINK_RE)) {
    const target = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(target)) continue;
    const clean = target.split("#")[0].split("?")[0];
    if (!clean) continue;
    const abs = clean.startsWith("/")
      ? join(root, clean)
      : resolve(dirname(file), clean);
    if (!existsSync(abs)) {
      errors.push(`${rel}: broken internal link "${target}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(`docs-check: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`docs-check: ${files.length} files OK`);
