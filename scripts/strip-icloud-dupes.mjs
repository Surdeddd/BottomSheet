import { readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

// iCloud Drive on macOS forks files written during sync into "name 2.ext"
// duplicates. They poison the npm tarball + bloat the package size. Strip
// them before publish.
//
// Lookahead allows multi-segment extensions like `.d.ts` so iCloud forks
// of TypeScript declarations (`react 2.d.ts`) are caught — without these,
// duplicate ambient declarations would ship and break consumer typecheck
// with TS2300.
const DUPE = / \d+(?=(?:\.[^./]+)+$)/;
const DRY = process.argv.includes("--dry");

let removed = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
    } else if (DUPE.test(entry)) {
      console.log(`${DRY ? "[dry] " : ""}rm ${path}`);
      if (!DRY) unlinkSync(path);
      removed += 1;
    }
  }
};

try {
  walk(dist);
} catch {
  // dist/ absent (clean build environment) — nothing to do.
  process.exit(0);
}

if (removed > 0) console.log(`✓ stripped ${removed} iCloud duplicates from dist/`);
