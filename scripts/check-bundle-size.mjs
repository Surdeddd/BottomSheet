#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const TRACKED = [
  "dist/index.js",
  "dist/react.js",
  "dist/preact.js",
  "dist/vue.js",
  "dist/svelte.js",
  "dist/solid.js",
  "dist/qwik.js",
  "dist/element.js",
  "dist/element.iife.global.js",
  "dist/overlay.js",
  "dist/styles.css",
  "dist/themes/ios.css",
  "dist/themes/material.css",
  "dist/themes/vercel.css",
];

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (arg.startsWith("--")) out[arg.slice(2)] = true;
  }
  return out;
}

function gzippedSize(filePath) {
  if (!existsSync(filePath)) return null;
  const buf = readFileSync(filePath);
  return {
    raw: statSync(filePath).size,
    gzip: gzipSync(buf, { level: 9 }).length,
  };
}

function measure(opts) {
  const result = {};
  for (const rel of TRACKED) {
    const abs = resolve(process.cwd(), rel);
    const sizes = gzippedSize(abs);
    if (sizes == null) {
      console.warn(`[bundle-size] missing: ${rel}`);
      result[rel] = { raw: 0, gzip: 0, missing: true };
    } else {
      result[rel] = sizes;
      console.log(
        `[bundle-size] ${rel}: ${(sizes.gzip / 1024).toFixed(2)} KB gzip ` +
          `(${(sizes.raw / 1024).toFixed(2)} KB raw)`,
      );
    }
  }
  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(result, null, 2));
    console.log(`[bundle-size] wrote ${opts.out}`);
  }
  return result;
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function fmtDelta(deltaPct) {
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(2)}%`;
}

function compare(opts) {
  const threshold = Number(opts.threshold ?? 5);
  if (!Number.isFinite(threshold) || threshold < 0) {
    console.error(`[bundle-size] invalid --threshold=${opts.threshold}`);
    process.exit(2);
  }
  if (!opts.base || !opts.head) {
    console.error("[bundle-size] compare requires --base= and --head=");
    process.exit(2);
  }
  const base = JSON.parse(readFileSync(opts.base, "utf8"));
  const head = JSON.parse(readFileSync(opts.head, "utf8"));

  const rows = [];
  let failed = false;
  for (const rel of TRACKED) {
    const b = base[rel]?.gzip ?? 0;
    const h = head[rel]?.gzip ?? 0;
    const delta = h - b;
    const pct = b === 0 ? (h === 0 ? 0 : Infinity) : (delta / b) * 100;
    const overBudget = Number.isFinite(pct) ? pct > threshold : h > 0;
    if (overBudget) failed = true;
    rows.push({ rel, baseGz: b, headGz: h, delta, pct, overBudget });
  }

  const lines = [];
  lines.push(`### Bundle size report (gzip, threshold ${threshold}%)`);
  lines.push("");
  lines.push("| File | Base | PR | Δ bytes | Δ % | Status |");
  lines.push("| --- | ---: | ---: | ---: | ---: | :---: |");
  for (const r of rows) {
    const status = r.overBudget ? "FAIL" : "ok";
    const pctStr = Number.isFinite(r.pct) ? fmtDelta(r.pct) : "n/a";
    lines.push(
      `| \`${r.rel}\` | ${fmtKB(r.baseGz)} | ${fmtKB(r.headGz)} | ${
        r.delta >= 0 ? "+" : ""
      }${r.delta} | ${pctStr} | ${status} |`,
    );
  }
  lines.push("");
  if (failed) {
    lines.push(
      `> One or more entries grew by more than **${threshold}%** gzipped. ` +
        "Investigate before merging — consider tree-shaking imports or " +
        "splitting heavier code paths into a separate entry.",
    );
  } else {
    lines.push(`> All tracked entries are within the ${threshold}% budget.`);
  }
  const md = lines.join("\n");

  if (opts.out) {
    writeFileSync(opts.out, md);
    console.log(`[bundle-size] wrote ${opts.out}`);
  }
  console.log(md);

  if (failed) {
    console.error(`[bundle-size] FAIL — entry exceeded ${threshold}% budget`);
    process.exit(1);
  }
}

const [, , cmd, ...rest] = process.argv;
const opts = parseArgs(rest);

switch (cmd) {
  case "measure":
    measure(opts);
    break;
  case "compare":
    compare(opts);
    break;
  default:
    console.error(
      "Usage: check-bundle-size.mjs <measure|compare> [--out=...] " +
        "[--base=...] [--head=...] [--threshold=5]",
    );
    process.exit(2);
}
