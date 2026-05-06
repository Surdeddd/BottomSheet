import { defineConfig } from "tsup";

// IIFE bundle for `<script src=...>` consumers. Self-contained, no peer
// deps, registers `<bottom-sheet>` as a side effect via defineBottomSheet().
// Run AFTER the main build (npm run build) — sequential, not parallel,
// to avoid esbuild formatMessages crashes when SFC plugins emit warnings.
export default defineConfig({
  entry: { "element.iife": "src/web-component/index.ts" },
  format: ["iife"],
  globalName: "surdeddd_bottomSheet",
  external: [],
  sourcemap: true,
  clean: false,
  minify: true,
  splitting: false,
  target: "es2020",
  dts: false,
  esbuildPlugins: [],
});
