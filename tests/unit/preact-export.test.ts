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
      `dist/ is missing — run \`npm run build\` before running preact-export tests. Looked at: ${distDir}`,
    );
  }
});

describe("@surdeddd/bottom-sheet/preact", () => {
  it("re-exports the React adapter's BottomSheet + useBottomSheet", async () => {
    const preactMod = await import(resolve(distDir, "preact.js"));
    const reactMod = await import(resolve(distDir, "react.js"));

    expect(preactMod.BottomSheet).toBeDefined();
    expect(preactMod.useBottomSheet).toBeTypeOf("function");

    expect(preactMod.BottomSheet).toBe(reactMod.BottomSheet);
    expect(preactMod.useBottomSheet).toBe(reactMod.useBottomSheet);
  });

  it("re-exports the same Overlay surface as the React adapter", async () => {
    const preactMod = await import(resolve(distDir, "preact.js"));
    const reactMod = await import(resolve(distDir, "react.js"));

    expect(preactMod.Overlay).toBeDefined();
    expect(preactMod.useOverlay).toBeTypeOf("function");
    expect(preactMod.Overlay).toBe(reactMod.Overlay);
    expect(preactMod.useOverlay).toBe(reactMod.useOverlay);
  });

  it("exposes the same set of named exports as the React adapter", async () => {
    const preactMod = await import(resolve(distDir, "preact.js"));
    const reactMod = await import(resolve(distDir, "react.js"));

    const norm = (m: Record<string, unknown>) =>
      Object.keys(m).filter(k => k !== "default").sort();

    expect(norm(preactMod)).toEqual(norm(reactMod));
  });
});
