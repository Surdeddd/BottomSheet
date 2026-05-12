// @vitest-environment node

import { describe, expect, it, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, "..", "..", "dist");

beforeAll(() => {
  if (!existsSync(distDir)) {
    throw new Error(
      `dist/ is missing — run \`npm run build\` before running vue-export tests. Looked at: ${distDir}`,
    );
  }
});

describe("@surdeddd/bottom-sheet/vue", () => {
  it("imports without throwing in pure Node (no DOM globals)", async () => {
    const mod = await import(resolve(distDir, "vue.js"));
    expect(mod.BottomSheet).toBeDefined();
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("exports a BottomSheet that looks like a Vue component", async () => {
    const mod = await import(resolve(distDir, "vue.js"));
    const cmp = mod.BottomSheet;
    expect(cmp).toBeDefined();
    expect(typeof cmp).toBe("object");
    const keys = Object.keys(cmp).concat(
      cmp.__v_isComponent ? ["__v_isComponent"] : [],
    );
    expect(keys.length).toBeGreaterThan(0);
  });

  it("exposes a useBottomSheet composable", async () => {
    const mod = await import(resolve(distDir, "vue.js"));
    expect(mod.useBottomSheet).toBeTypeOf("function");
  });

  it("does not expose React/Solid/Qwik primitives by mistake", async () => {
    const mod = await import(resolve(distDir, "vue.js"));
    expect(mod).not.toHaveProperty("createSignal");
    expect(mod).not.toHaveProperty("useSyncExternalStore");
    expect(mod).not.toHaveProperty("component$");
  });
});
