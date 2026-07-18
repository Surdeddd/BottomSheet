import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "tests", "bench", "bench-baseline.json");
const update = process.argv.includes("--update");
const benchFileCount = readdirSync(join(root, "tests", "bench")).filter(f =>
  f.endsWith(".bench.ts"),
).length;

const collect = data => {
  const benches = {};
  for (const file of data.files ?? []) {
    for (const group of file.groups ?? []) {
      const groupName = group.fullName.split(" > ").slice(1).join(" > ");
      for (const b of group.benchmarks ?? []) {
        benches[`${groupName} > ${b.name}`] = Math.round(b.hz);
      }
    }
  }
  return benches;
};

const runBenchesOnce = () => {
  const dir = mkdtempSync(join(tmpdir(), "bs-bench-"));
  const out = join(dir, "bench.json");
  try {
    execFileSync(
      join(root, "node_modules", ".bin", "vitest"),
      [
        "bench",
        "--run",
        "--pool=forks",
        "--no-file-parallelism",
        "--outputJson",
        out,
      ],
      { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
    );
  } catch {
  }
  let benches = null;
  let filesInReport = 0;
  try {
    const data = JSON.parse(readFileSync(out, "utf8"));
    filesInReport = (data.files ?? []).length;
    benches = collect(data);
  } catch {
  }
  rmSync(dir, { recursive: true, force: true });
  if (!benches || filesInReport < benchFileCount) return null;
  return benches;
};

const runBenches = () => {
  const first = runBenchesOnce();
  if (first) return first;
  console.error("bench-check: bench run produced no report, retrying once");
  const second = runBenchesOnce();
  if (second) return second;
  console.error("bench-check: bench runner failed twice");
  process.exit(1);
};

const current = runBenches();

if (update) {
  const baseline = {
    generatedOn: new Date().toISOString().slice(0, 10),
    note: "ops/s floors; gate fails below baseline/floorDivisor (shared CI runners are slow and noisy, only order-of-magnitude regressions should trip)",
    floorDivisor: 10,
    benches: current,
  };
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`bench-check: baseline updated (${Object.keys(current).length} benches)`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const divisor = baseline.floorDivisor ?? 5;
const rows = [];
const violations = [];

for (const [name, base] of Object.entries(baseline.benches)) {
  const hz = current[name];
  const floor = Math.round(base / divisor);
  if (hz === undefined) {
    violations.push(name);
    rows.push({ name, base, floor, hz: "MISSING", ok: false });
    continue;
  }
  const ok = hz >= floor;
  if (!ok) violations.push(name);
  rows.push({ name, base, floor, hz, ok });
}

for (const name of Object.keys(current)) {
  if (!(name in baseline.benches)) {
    console.log(`bench-check: new bench without baseline (run --update): ${name}`);
  }
}

const fmt = n => (typeof n === "number" ? n.toLocaleString("en-US") : n);
for (const r of rows) {
  const mark = r.ok ? "ok  " : "FAIL";
  console.log(`${mark}  ${fmt(r.hz)} ops/s (floor ${fmt(r.floor)}, base ${fmt(r.base)})  ${r.name}`);
}

if (violations.length > 0) {
  console.error(`\nbench-check: ${violations.length} bench(es) below the ${divisor}x regression floor`);
  process.exit(1);
}
console.log(`\nbench-check: ${rows.length} benches within the ${divisor}x floor`);
