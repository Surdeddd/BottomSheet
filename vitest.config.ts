import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
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
