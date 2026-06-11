import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json"],
      reportsDirectory: "./coverage",
      include: ["src/**"],
      exclude: ["src/**/*.d.ts", "src/**/*.template", "src/**/shims-*.d.ts"],
    },
    benchmark: {
      include: ["tests/bench/**/*.bench.ts"],
      reporters: ["default"],
    },
  },
});
