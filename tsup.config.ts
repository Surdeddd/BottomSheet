import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import VuePlugin from "unplugin-vue/esbuild";
import sveltePlugin from "esbuild-svelte";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
    preact: "src/preact/index.ts",
    vue: "src/vue/index.ts",
    element: "src/web-component/index.ts",
    svelte: "src/svelte/index.ts",
    "svelte-core": "src/svelte/useBottomSheet.svelte.ts",
    qwik: "src/qwik/index.tsx",
    overlay: "src/core/overlay.ts",
    "integrations/react-hook-form": "src/integrations/react-hook-form.ts",
    "integrations/formik": "src/integrations/formik.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    entry: {
      index: "src/index.ts",
      react: "src/react/index.ts",
      preact: "src/preact/index.ts",
      element: "src/web-component/index.ts",
      qwik: "src/qwik/index.tsx",
      overlay: "src/core/overlay.ts",
      "integrations/react-hook-form": "src/integrations/react-hook-form.ts",
      "integrations/formik": "src/integrations/formik.ts",
    },
  },
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
