// Removes dist/ before tsup builds. We do this in a prebuild step rather
// than via tsup's own `clean: true` because tsup runs our two configs (the
// main esm/cjs build and the IIFE pass) in parallel — `clean: true` on one
// config can wipe the other's output mid-build, producing flaky failures
// where one bundle's files vanish from dist/.

import { rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

rmSync(dist, { recursive: true, force: true });
console.log(`✓ cleaned ${dist}`);
