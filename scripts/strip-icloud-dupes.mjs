import { readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

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
  process.exit(0);
}

if (removed > 0) console.log(`✓ stripped ${removed} iCloud duplicates from dist/`);
