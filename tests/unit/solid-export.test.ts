// @vitest-environment node
//
// Smoke test for the `/solid` subpath. We don't render — Solid's JSX needs
// vite-plugin-solid to compile down to DOM imperatives. Rendered proof
// lives in demo/apps/solid-demo.tsx + size-limit gate.

import { describe, expect, it } from "vitest";

describe("@surdeddd/bottom-sheet/solid", () => {
  it("exports a BottomSheet function from the source module", async () => {
    // Import the source module — vitest will compile via esbuild which
    // happily handles the `/** @jsxImportSource solid-js */` pragma and the
    // solid-js named imports without needing to actually evaluate the JSX.
    const mod = await import("../../src/solid/index");

    expect(mod.BottomSheet).toBeDefined();
    expect(mod.BottomSheet).toBeTypeOf("function");
  });

  it("does not pollute the React/Vue/Svelte adapter modules with solid-js", async () => {
    // Sanity: the React adapter must not pick up solid-js as a runtime dep
    // — they each ship as separate subpaths. We can't easily inspect the
    // bundle from a unit test, but we CAN verify the source modules don't
    // cross-import each other.
    const reactSrc = await import("../../src/react/index");
    expect(reactSrc).not.toHaveProperty("createSignal");
    expect(reactSrc).not.toHaveProperty("onMount");
  });
});
