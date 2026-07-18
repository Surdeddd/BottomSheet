import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const libEntry = join(root, "dist", "qwik-lib", "index.qwik.mjs");

if (!existsSync(libEntry)) {
  console.error("qwik-ssr-check: dist/qwik-lib missing — run `npm run build` first");
  process.exit(1);
}

const { build } = await import(
  pathToFileURL(join(root, "node_modules", "vite", "dist", "node", "index.js")).href
);
const { qwikVite } = await import(
  pathToFileURL(
    join(root, "node_modules", "@builder.io", "qwik", "dist", "optimizer.mjs"),
  ).href
);

const cacheRoot = join(root, "node_modules", ".cache");
mkdirSync(cacheRoot, { recursive: true });
const work = mkdtempSync(join(cacheRoot, "bs-qwik-ssr-"));
const src = join(work, "src");
mkdirSync(src, { recursive: true });
const libRoot = join(root, "dist", "qwik-lib");

writeFileSync(
  join(work, "package.json"),
  JSON.stringify({ name: "bs-qwik-ssr-probe", type: "module" }),
);

const rootTsx = `/** @jsxImportSource @builder.io/qwik */
import { component$ } from "@builder.io/qwik";
import { BottomSheet } from "@surdeddd/bottom-sheet/qwik-lib";

export default component$(() => (
  <BottomSheet
    snapPoints={[
      { id: "closed", size: 0 },
      { id: "half", size: 300 },
    ]}
    initial="half"
    ariaLabel="ssr sheet"
  >
    <p>ssr content row</p>
  </BottomSheet>
));
`;

const entrySsr = `/** @jsxImportSource @builder.io/qwik */
import { renderToString } from "@builder.io/qwik/server";
import { BottomSheet } from "@surdeddd/bottom-sheet/qwik-lib";

export async function render(manifest) {
  const result = await renderToString(
    <BottomSheet
      snapPoints={[
        { id: "closed", size: 0 },
        { id: "half", size: 300 },
      ]}
      initial="half"
      ariaLabel="ssr sheet"
    >
      <p>ssr content row</p>
    </BottomSheet>,
    { containerTagName: "div", manifest },
  );
  return result.html;
}
`;

writeFileSync(join(src, "root.tsx"), rootTsx, { flag: "w" });
writeFileSync(join(src, "entry.ssr.tsx"), entrySsr);

const alias = {
  "@surdeddd/bottom-sheet/qwik-lib": join(libRoot, "index.qwik.mjs"),
};

const clientOut = join(work, "dist-client");
const ssrOut = join(work, "dist-ssr");

await build({
  configFile: false,
  root: work,
  logLevel: "warn",
  plugins: [
    qwikVite({
      vendorRoots: [libRoot],
      client: { input: join(src, "root.tsx"), outDir: clientOut },
    }),
  ],
  resolve: { alias },
  build: { target: "es2020", outDir: clientOut, emptyOutDir: true },
});

await build({
  configFile: false,
  root: work,
  mode: "production",
  logLevel: "warn",
  plugins: [
    qwikVite({
      vendorRoots: [libRoot],
      ssr: { input: join(src, "entry.ssr.tsx") },
    }),
  ],
  resolve: { alias },
  build: {
    target: "es2020",
    outDir: ssrOut,
    emptyOutDir: true,
    ssr: true,
    rollupOptions: { input: join(src, "entry.ssr.tsx") },
  },
});

const manifest = JSON.parse(
  readFileSync(join(clientOut, "q-manifest.json"), "utf8"),
);
const mod = await import(pathToFileURL(join(ssrOut, "entry.ssr.js")).href);
const html = await mod.render(manifest);

const checks = {
  "renders markup": html.length > 500,
  "paused container": html.includes('q:container="paused"'),
  "bs-sheet present": html.includes("bs-sheet"),
  "aria label": html.includes("ssr sheet"),
  "slot content": html.includes("ssr content row"),
};

let failed = 0;
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}

rmSync(work, { recursive: true, force: true });

if (failed > 0) {
  console.error(`qwik-ssr-check: ${failed} check(s) failed`);
  process.exit(1);
}
console.log("qwik-ssr-check: consumer client+SSR flow OK");
