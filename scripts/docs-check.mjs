import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");

const collectMarkdown = dir => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "api") continue;
    if (statSync(full).isDirectory()) out.push(...collectMarkdown(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
};

const files = [
  join(root, "README.md"),
  join(root, "README.ru.md"),
  join(root, "CONTRIBUTING.md"),
  join(root, "CHANGELOG.md"),
  join(root, "llms.txt"),
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

const withoutCode = text =>
  text.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, "").replace(/`[^`\n]*`/g, "");

const slugsOf = file => {
  const seen = new Map();
  const slugs = new Set();
  const text = readFileSync(file, "utf8").replace(
    /^(```|~~~)[\s\S]*?^\1[^\n]*$/gm,
    "",
  );
  for (const m of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const plain = m[1]
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .replace(/<[^>]+>/g, "");
    const base = plain
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
};

const slugCache = new Map();
const hasAnchor = (file, anchor) => {
  if (!slugCache.has(file)) slugCache.set(file, slugsOf(file));
  return slugCache.get(file).has(decodeURIComponent(anchor).toLowerCase());
};

const errors = [];

const SCRIPT_RE = /npm run ([a-zA-Z0-9:_-]+)/g;
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = file.slice(root.length + 1);
  const history = rel === "CHANGELOG.md";

  if (!history) {
    for (const m of text.matchAll(SCRIPT_RE)) {
      const name = m[1];
      if (!knownScripts.has(name)) {
        errors.push(`${rel}: references non-existent npm script "npm run ${name}"`);
      }
    }
  }

  for (const m of withoutCode(text).matchAll(LINK_RE)) {
    const target = m[1];
    if (/^(https?:|mailto:|data:)/.test(target)) continue;
    const [path, anchor] = target.split("#");
    const clean = path.split("?")[0];
    const abs = !clean
      ? file
      : clean.startsWith("/")
        ? join(root, clean)
        : resolve(dirname(file), clean);
    if (!existsSync(abs)) {
      errors.push(`${rel}: broken internal link "${target}"`);
      continue;
    }
    if (anchor && abs.endsWith(".md") && !hasAnchor(abs, anchor)) {
      errors.push(`${rel}: no heading for the anchor in "${target}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(`docs-check: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`docs-check: ${files.length} files OK`);
