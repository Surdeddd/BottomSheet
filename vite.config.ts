import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "demo"),
  plugins: [
    solid({ include: ["**/solid-demo.tsx", "**/src/solid/**/*.tsx"] }),
    react({ exclude: [/solid-demo\.tsx$/, /src\/solid\/.*\.tsx$/] }),
    vue(),
    svelte(),
  ],
  resolve: {
    alias: {
      "@surdeddd/bottom-sheet/react": resolve(__dirname, "src/react/index.ts"),
      "@surdeddd/bottom-sheet/vue": resolve(__dirname, "src/vue/index.ts"),
      "@surdeddd/bottom-sheet/svelte": resolve(__dirname, "src/svelte/index.ts"),
      "@surdeddd/bottom-sheet/solid": resolve(__dirname, "src/solid/index.tsx"),
      "@surdeddd/bottom-sheet/element": resolve(
        __dirname,
        "src/web-component/index.ts",
      ),
      "@surdeddd/bottom-sheet/styles": resolve(
        __dirname,
        "src/styles/bottom-sheet.css",
      ),
      "@surdeddd/bottom-sheet/themes/ios": resolve(
        __dirname,
        "src/styles/themes/ios.css",
      ),
      "@surdeddd/bottom-sheet/themes/material": resolve(
        __dirname,
        "src/styles/themes/material.css",
      ),
      "@surdeddd/bottom-sheet/themes/vercel": resolve(
        __dirname,
        "src/styles/themes/vercel.css",
      ),
      "@surdeddd/bottom-sheet": resolve(__dirname, "src/index.ts"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "demo/index.html"),
        dismissible: resolve(__dirname, "demo/fixtures/dismissible.html"),
        mountOpen: resolve(__dirname, "demo/fixtures/mount-open.html"),
      },
    },
  },
  optimizeDeps: {
    exclude: ["vaul", "react-modal-sheet"],
  },
});
