import { defineConfig } from "tsup";

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
