// @vitest-environment node

import { describe, expect, it, beforeAll } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
    const cmp = mod.BottomSheet;
    expect(["function", "object"]).toContain(typeof cmp);
  });

  it("does not expose React/Vue/Qwik primitives by mistake", async () => {
    const mod = await import(resolve(distDir, "svelte.js"));
    expect(mod).not.toHaveProperty("createSignal");
    expect(mod).not.toHaveProperty("useSyncExternalStore");
    expect(mod).not.toHaveProperty("component$");
  });

  it("ships a svelte-src whose relative imports all resolve inside dist/", () => {
    const srcDir = resolve(distDir, "svelte-src");
    const unresolved: string[] = [];
    for (const file of readdirSync(srcDir)) {
      const source = readFileSync(resolve(srcDir, file), "utf8");
      for (const m of source.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
        if (!existsSync(resolve(srcDir, m[1]!))) unresolved.push(`${file}: ${m[1]}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("exposes the teleport helpers that the svelte-src component imports", async () => {
    const core = await import(resolve(distDir, "svelte-core.js"));
    expect(core.resolveTeleportTarget).toBeTypeOf("function");
    expect(core.teleportElements).toBeTypeOf("function");
  });
});
