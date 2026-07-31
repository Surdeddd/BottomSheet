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
      // The .vue / .svelte entries are not taste: coverage-v8 v4 remaps through
      // rolldown, which parses them as JavaScript and dies on the first
      // `<script>` tag. It already drops them from the report on its own —
      // without the exclude it also fails the entire run.
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.template",
        "src/**/shims-*.d.ts",
        "src/**/*.vue",
        "src/**/*.svelte",
      ],
    },
    benchmark: {
      include: ["tests/bench/**/*.bench.ts"],
      reporters: ["default"],
    },
  },
});
