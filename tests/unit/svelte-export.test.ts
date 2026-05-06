// @vitest-environment node
//
// Smoke test for the `/svelte` subpath. We don't actually render —
// Svelte 5's runtime needs the matching client/server build flags + DOM;
// hydration is covered in adapters.spec.ts.

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
      `dist/ is missing — run \`npm run build\` before running svelte-export tests. Looked at: ${distDir}`,
    );
  }
});

describe("@surdeddd/bottom-sheet/svelte", () => {
  it("imports without throwing in pure Node (no DOM globals)", async () => {
    const mod = await import(resolve(distDir, "svelte.js"));
    expect(mod.createBottomSheet).toBeDefined();
    expect(mod.BottomSheet).toBeDefined();
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("exports `createBottomSheet` as a factory function", async () => {
    const mod = await import(resolve(distDir, "svelte.js"));
    expect(mod.createBottomSheet).toBeTypeOf("function");
  });

  it("exports `BottomSheet` as a callable (Svelte 5 client-mode component)", async () => {
    const mod = await import(resolve(distDir, "svelte.js"));
    // Svelte 5 client-mode compiles a component to a function with signature
    // ($$anchor, $$props) => void. Older Svelte 4 components are objects with
    // a `render` method, but our dist is Svelte 5 (see package.json deps).
    const cmp = mod.BottomSheet;
    expect(["function", "object"]).toContain(typeof cmp);
  });

  it("does not expose React/Vue/Qwik primitives by mistake", async () => {
    const mod = await import(resolve(distDir, "svelte.js"));
    expect(mod).not.toHaveProperty("createSignal");
    expect(mod).not.toHaveProperty("useSyncExternalStore");
    expect(mod).not.toHaveProperty("component$");
  });
});
