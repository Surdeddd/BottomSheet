import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    // 15s — most tests are <100ms but Svelte 5 SFC compile + happy-dom
    // env warm-up can spike past 5s under parallel-worker contention
    // (notably ssr.test.ts and svelte-export.test.ts when the pre-commit
    // hook also runs tsc + lint concurrently). 15s gives headroom without
    // hiding genuine hangs.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json"],
      reportsDirectory: "./coverage",
      include: ["src/core/**"],
    },
    benchmark: {
      include: ["tests/bench/**/*.bench.ts"],
      reporters: ["default"],
    },
  },
});
