import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROW = /^\|\s*((?:`[^`]+`(?:,\s*)?)+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/;
const NO_DEFAULT = new Set(["none", "required", "off", "all"]);
const OPENING = "type EngineOptions = {";
const MEMBER = /^ {4}([A-Za-z]\w*)\??:/;

const plain = text =>
  text.replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, "$1").trim();

export const optionDocs = readme => {
  const docs = new Map();
  const start = readme.indexOf("### Options");
  if (start < 0) return docs;
  const rest = readme.slice(start + 1);
  const end = rest.search(/^### /m);
  const section = end < 0 ? rest : rest.slice(0, end);
  let engine = false;
  for (const line of section.split("\n")) {
    const heading = /^\|\s*(Option|Prop)\s*\|/.exec(line);
    if (heading) engine = heading[1] === "Option";
    const row = engine ? ROW.exec(line) : null;
    if (!row) continue;
    const [, names, fallback, meaning] = row;
    if (!names || !meaning) continue;
    const text = NO_DEFAULT.has(fallback)
      ? plain(meaning)
      : `${plain(meaning)}\n\nDefault: ${fallback}`;
    for (const name of names.matchAll(/`([^`]+)`/g)) docs.set(name[1], text);
  }
  return docs;
};

const comment = text => {
  const lines = text.split("\n");
  if (lines.length === 1) return `    /** ${text} */`;
  return [
    "    /**",
    ...lines.map(line => (line ? `     * ${line}` : "     *")),
    "     */",
  ].join("\n");
};

export const annotate = (declaration, docs) => {
  const lines = declaration.split("\n");
  const from = lines.indexOf(OPENING);
  if (from < 0) return declaration;
  const out = lines.slice(0, from + 1);
  let inside = true;
  for (let i = from + 1; i < lines.length; i++) {
    const line = lines[i];
    if (inside && line === "};") inside = false;
    const member = inside ? MEMBER.exec(line) : null;
    const text = member ? docs.get(member[1]) : undefined;
    const documented = (lines[i - 1] ?? "").trimEnd().endsWith("*/");
    if (text && !documented) out.push(comment(text));
    out.push(line);
  }
  return out.join("\n");
};

const main = () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const docs = optionDocs(readFileSync(resolve(root, "README.md"), "utf8"));
  const dist = resolve(root, "dist");
  let written = 0;
  for (const file of readdirSync(dist)) {
    if (!/\.d\.c?ts$/.test(file)) continue;
    const path = resolve(dist, file);
    const before = readFileSync(path, "utf8");
    const after = annotate(before, docs);
    if (after === before) continue;
    writeFileSync(path, after);
    written++;
  }
  if (written === 0) {
    console.error("✗ no declaration file holds EngineOptions");
    process.exitCode = 1;
    return;
  }
  console.log(`✓ option descriptions written into ${written} declaration files`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
