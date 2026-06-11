import { defineConfig } from "tsup";
import { solidPlugin } from "esbuild-plugin-solid";

export default defineConfig([
  {
    entry: {
      solid: "src/solid/index.tsx",
    },
    format: ["esm", "cjs"],
    dts: {
      entry: {
        solid: "src/solid/index.tsx",
      },
    },
    splitting: false,
    sourcemap: true,
    clean: false,
    external: ["solid-js", "solid-js/web", "solid-js/store"],
    treeshake: true,
    target: "es2020",
    esbuildPlugins: [solidPlugin()],
  },
  {
    entry: {
      "solid.source": "src/solid/index.tsx",
    },
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    external: ["solid-js", "solid-js/web", "solid-js/store"],
    treeshake: false,
    target: "esnext",
    outExtension: () => ({ js: ".jsx" }),
    esbuildOptions(options) {
      options.jsx = "preserve";
    },
  },
]);
