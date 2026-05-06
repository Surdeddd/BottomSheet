import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import VuePlugin from "unplugin-vue/esbuild";
import sveltePlugin from "esbuild-svelte";

// Single config — IIFE moved to a separate `build:iife` npm script so it
// runs sequentially after the main esm/cjs build and doesn't race with
// the DTS / SFC plugin passes (the parallel build broke esbuild's
// formatMessages on Svelte plugin warnings).
export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
    preact: "src/preact/index.ts",
    vue: "src/vue/index.ts",
    element: "src/web-component/index.ts",
    svelte: "src/svelte/index.ts",
    qwik: "src/qwik/index.tsx",
    solid: "src/solid/index.tsx",
    // Overlay published as a separate subpath (`@surdeddd/bottom-sheet/overlay`).
    // Consumers who only need the slide-up panel primitive (no gestures, no
    // snap points) skip the bottom-sheet engine bundle entirely. Barrel
    // re-export from `src/index.ts` is kept for backwards compatibility but
    // marked @deprecated.
    overlay: "src/core/overlay.ts",
    "integrations/react-hook-form": "src/integrations/react-hook-form.ts",
    "integrations/formik": "src/integrations/formik.ts",
  },
  format: ["esm", "cjs"],
  // Skip dts for SFC subpaths — rollup-based dts emitter chokes on .vue/.svelte
  // imports. Hand-written shims are emitted via onSuccess.
  dts: {
    entry: {
      index: "src/index.ts",
      react: "src/react/index.ts",
      preact: "src/preact/index.ts",
      element: "src/web-component/index.ts",
      qwik: "src/qwik/index.tsx",
      solid: "src/solid/index.tsx",
      overlay: "src/core/overlay.ts",
      "integrations/react-hook-form": "src/integrations/react-hook-form.ts",
      "integrations/formik": "src/integrations/formik.ts",
    },
  },
  // splitting=true was tried but adds ~1-2 KB chunk-overhead per adapter for
  // the single-adapter case (typical consumer). Engine duplication across
  // adapters costs less than tsup's module-graph metadata + chunk wiring.
  // The honest fix is subpath exports for OverlayEngine — a v2 architectural
  // change. Keep splitting off until that's settled.
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "vue",
    "svelte",
    "preact",
    "preact/compat",
    "@builder.io/qwik",
    "@builder.io/qwik/jsx-runtime",
    "solid-js",
    "solid-js/web",
    "solid-js/jsx-runtime",
    "react-hook-form",
    "formik",
  ],
  treeshake: true,
  target: "es2020",
  esbuildPlugins: [
    VuePlugin({}),
    sveltePlugin({
      compilerOptions: { generate: "client" as any },
      // Drop ALL Svelte compile warnings — esbuild's formatMessages crashes
      // on certain Svelte 5 a11y/state-referenced-locally messages with
      // malformed `length` fields. Real errors still surface as exceptions.
      filterWarnings: () => false,
    }),
  ],
  onSuccess: async () => {
    const distDir = resolve("dist");
    if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
    copyFileSync(
      resolve("src/styles/bottom-sheet.css"),
      resolve("dist/styles.css"),
    );
    // Theme presets — opt-in subpath imports. Each consumer mounts only one
    // theme; we ship them as siblings of styles.css instead of inlining,
    // so the base bundle stays slim. Defensive: skip individual themes that
    // haven't been authored yet so the missing-file ENOENT doesn't crash
    // the onSuccess hook (which would silently skip the IIFE build + the
    // postbuild script chain — preact thin-rewrite, IIFE bundle).
    const themesDir = resolve("dist/themes");
    if (!existsSync(themesDir)) mkdirSync(themesDir, { recursive: true });
    for (const name of ["ios", "material", "vercel"]) {
      const src = resolve(`src/styles/themes/${name}.css`);
      if (existsSync(src)) {
        copyFileSync(src, resolve(`dist/themes/${name}.css`));
      }
    }
    copyFileSync(
      resolve("src/vue/index.d.ts.template"),
      resolve("dist/vue.d.ts"),
    );
    copyFileSync(
      resolve("src/svelte/index.d.ts.template"),
      resolve("dist/svelte.d.ts"),
    );
    console.log(
      "✓ styles.css + themes/{ios,material,vercel}.css + vue.d.ts + svelte.d.ts written to dist/",
    );
  },
});
