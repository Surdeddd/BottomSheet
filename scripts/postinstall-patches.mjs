import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const patchesDir = resolve(root, "patches");

if (!existsSync(patchesDir)) {
  process.exit(0);
}

const patchPackageBin = resolve(root, "node_modules/.bin/patch-package");
if (!existsSync(patchPackageBin)) {
  console.log(
    "[postinstall] patch-package not installed (--omit=dev?) — skipping patches/",
  );
  process.exit(0);
}

const result = spawnSync(patchPackageBin, [], { stdio: "inherit", cwd: root });
process.exit(result.status ?? 0);
