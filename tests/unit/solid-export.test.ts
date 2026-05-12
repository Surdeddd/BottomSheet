// @vitest-environment node

import { describe, expect, it } from "vitest";

describe("@surdeddd/bottom-sheet/solid", () => {
  it("exports a BottomSheet function from the source module", async () => {
    const mod = await import("../../src/solid/index");

    expect(mod.BottomSheet).toBeDefined();
    expect(mod.BottomSheet).toBeTypeOf("function");
  });

  it("does not pollute the React/Vue/Svelte adapter modules with solid-js", async () => {
    const reactSrc = await import("../../src/react/index");
    expect(reactSrc).not.toHaveProperty("createSignal");
    expect(reactSrc).not.toHaveProperty("onMount");
  });
});
