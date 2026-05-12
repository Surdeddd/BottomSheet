import { readFileSync, writeFileSync } from "node:fs";

function stripCss(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '"' || c === "'") {
      const q = c;
      out += c;
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        out += src[i++];
      }
      if (i < n) { out += src[i++]; }
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      if (i < n) i += 2;
      continue;
    }
    out += c;
    i++;
  }
  const lines = out.split("\n");
  const collapsed = [];
  let blankRun = 0;
  for (const line of lines) {
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

for (const f of process.argv.slice(2)) {
  const src = readFileSync(f, "utf8");
  const out = stripCss(src);
  writeFileSync(f, out);
  console.log(`${f}: -${src.split("\n").length - out.split("\n").length} lines`);
}
