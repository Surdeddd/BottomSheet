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
const libRoot = join(root, "dist", "qwik-lib");

export const repoRoot = root;

export async function buildQwikProbe({ name, rootTsx, entrySsr, renderOptions }) {
  if (!existsSync(join(libRoot, "index.qwik.mjs"))) {
    throw new Error(`${name}: dist/qwik-lib missing — run \`npm run build\` first`);
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
  const work = mkdtempSync(join(cacheRoot, `bs-${name}-`));
  const src = join(work, "src");
  mkdirSync(src, { recursive: true });

  writeFileSync(
    join(work, "package.json"),
    JSON.stringify({ name: `bs-${name}`, type: "module" }),
  );
  writeFileSync(join(src, "root.tsx"), rootTsx);
  writeFileSync(join(src, "entry.ssr.tsx"), entrySsr);

  const alias = {
    "@surdeddd/bottom-sheet/qwik-lib": join(libRoot, "index.qwik.mjs"),
  };
  const clientOut = join(work, "dist-client");
  const ssrOut = join(work, "dist-ssr");
  const cleanup = () => rmSync(work, { recursive: true, force: true });

  try {
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
    const html = await mod.render(manifest, renderOptions);
    return { html, clientOut, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function report(name, checks) {
  let failed = 0;
  for (const [label, ok] of Object.entries(checks)) {
    console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
    if (!ok) failed += 1;
  }
  if (failed > 0) {
    console.error(`${name}: ${failed} check(s) failed`);
    process.exit(1);
  }
}
