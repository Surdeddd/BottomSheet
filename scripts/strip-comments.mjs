import { readFileSync, writeFileSync } from "node:fs";

const PRAGMA_LINE = /^\/\/\s*(@ts-|eslint-|biome-|prettier-|@vitest-|@vue\/|@vite-|webpackIgnore|@__PURE__|#__PURE__|noinspection)/i;
const PRAGMA_BLOCK = /^\/\*\*?\s*(eslint-|@__PURE__|#__PURE__|@vite-|webpackIgnore|prettier-|@ts-|@jsxImportSource|@jsxRuntime|@jsx |@jsxFrag)/i;

function strip(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let lastSig = "";
  let inTpl = false;
  let tplDepth = 0;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (inTpl) {
      out += c;
      if (c === "\\") { out += src[i + 1] || ""; i += 2; continue; }
      if (c === "$" && c2 === "{") { tplDepth++; out += "{"; i += 2; lastSig = "{"; continue; }
      if (c === "`") { inTpl = false; }
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      out += c;
      i++;
      while (i < n) {
        const cc = src[i];
        out += cc;
        if (cc === "\\") { out += src[i + 1] || ""; i += 2; continue; }
        if (cc === q) { i++; break; }
        if (cc === "\n") { i++; break; }
        i++;
      }
      lastSig = q;
      continue;
    }
    if (c === "`") {
      inTpl = true;
      tplDepth = 0;
      out += c;
      i++;
      continue;
    }
    if (c === "}" && tplDepth > 0) { tplDepth--; out += c; i++; lastSig = c; continue; }
    if (c === "/" && c2 === "/") {
      const rest = src.slice(i);
      if (PRAGMA_LINE.test(rest)) {
        while (i < n && src[i] !== "\n") { out += src[i++]; }
        continue;
      }
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      const rest = src.slice(i);
      if (PRAGMA_BLOCK.test(rest)) {
        out += "/*";
        i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i++]; }
        if (i < n) { out += "*/"; i += 2; }
        continue;
      }
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      if (i < n) i += 2;
      continue;
    }
    if (c === "/") {
      if (lastSig === "" || /[=({,;:?!&|+\-*<>%^~\[\n]/.test(lastSig) || /^(return|typeof|in|of|instanceof|new|throw|delete|void|case)$/.test(lastWord(out))) {
        let j = i + 1;
        let escaped = false;
        let inCls = false;
        let okRegex = false;
        while (j < n) {
          const cc = src[j];
          if (escaped) { escaped = false; j++; continue; }
          if (cc === "\\") { escaped = true; j++; continue; }
          if (cc === "[") { inCls = true; j++; continue; }
          if (cc === "]") { inCls = false; j++; continue; }
          if (cc === "/" && !inCls) { j++; while (j < n && /[gimsuy]/.test(src[j])) j++; okRegex = true; break; }
          if (cc === "\n") break;
          j++;
        }
        if (okRegex) {
          out += src.slice(i, j);
          i = j;
          lastSig = "/";
          continue;
        }
      }
    }
    out += c;
    if (!/\s/.test(c)) lastSig = c;
    i++;
  }
  const lines = out.split("\n");
  const filtered = lines.filter(line => !/^\s*\{\s*\}\s*$/.test(line));
  const collapsed = [];
  let blankRun = 0;
  for (const line of filtered) {
    if (/^\s*$/.test(line)) {
      blankRun++;
      if (blankRun <= 1) collapsed.push("");
    } else {
      blankRun = 0;
      collapsed.push(line);
    }
  }
  while (collapsed.length && collapsed[0] === "") collapsed.shift();
  while (collapsed.length && collapsed[collapsed.length - 1] === "") collapsed.pop();
  return collapsed.join("\n") + "\n";
}

function lastWord(s) {
  const m = s.match(/[A-Za-z_$][\w$]*\s*$/);
  return m ? m[0].trim() : "";
}

const files = process.argv.slice(2);
let total = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const out = strip(src);
  writeFileSync(f, out);
  const removed = src.split("\n").length - out.split("\n").length;
  total += Math.max(0, removed);
  console.log(`${f}: -${removed} lines`);
}
console.log(`total: -${total} lines`);
