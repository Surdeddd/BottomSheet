import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [qwikVite()],
  build: {
    target: "es2020",
    outDir: resolve(__dirname, "dist/qwik-lib"),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/qwik/index.tsx"),
      formats: ["es", "cjs"],
      fileName: format => `index.qwik.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        "@builder.io/qwik",
        "@builder.io/qwik/jsx-runtime",
        "@builder.io/qwik/build",
      ],
    },
  },
});
