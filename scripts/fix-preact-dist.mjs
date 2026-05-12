import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const esmContent = "export * from \"./react.js\";\n";
const cjsContent = "\"use strict\";\nmodule.exports = require(\"./react.cjs\");\n";

writeFileSync(resolve(root, "dist/preact.js"), esmContent, "utf8");
writeFileSync(resolve(root, "dist/preact.cjs"), cjsContent, "utf8");
console.log("done");
