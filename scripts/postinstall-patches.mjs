// Apply node_modules patches via patch-package, gracefully no-op when:
//   - the patches/ dir is absent (e.g. consumer installed from npm tarball)
//   - patch-package isn't installed (e.g. `npm install --omit=dev`)
//
// We avoid the bare `patch-package` binary in postinstall because it crashes
// on missing-dep scenarios. This wrapper makes the postinstall hook idempotent
// and safe across install modes.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const patchesDir = resolve(root, "patches");

if (!existsSync(patchesDir)) {
  // Nothing to apply — clean install of the published package.
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
