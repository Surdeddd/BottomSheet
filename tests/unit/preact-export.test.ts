// @vitest-environment node
//
// Smoke test for the `@surdeddd/bottom-sheet/preact` subpath.
//
// The Preact adapter is a zero-cost re-export of the React adapter — see
// `src/preact/index.ts` and `docs/preact.md`. We do NOT actually render
// with Preact here (would require pulling in preact-compat as a real dep
// and aliasing react → preact/compat for this test only). Instead we
// assert the module-level invariant that matters: the `/preact` subpath
// exposes the SAME public shape as the `/react` subpath.
//
// We exercise the BUILT dist artifacts (matching what consumers ship) so
// this test depends on `npm run build` having run first — same convention
// as `tests/unit/ssr.test.ts`.

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

    // BottomSheet should be present on both. forwardRef yields an object,
    // not a function, so we don't tighten this beyond `.toBeDefined()`.
    expect(preactMod.BottomSheet).toBeDefined();
    expect(preactMod.useBottomSheet).toBeTypeOf("function");

    // The two subpaths must be the SAME module — same component identity,
    // same hook identity. If this ever drifts, the doc claim "zero-cost
    // re-export" is no longer true and consumers may end up with two
    // copies of the React adapter in their bundle.
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

    // Filter out the default export (re-export semantics differ for it
    // across CJS/ESM and we never expose a default from the React entry).
    const norm = (m: Record<string, unknown>) =>
      Object.keys(m).filter(k => k !== "default").sort();

    expect(norm(preactMod)).toEqual(norm(reactMod));
  });
});
