// @vitest-environment node
//
// Qwik's `component$` is an optimizer-rewritten macro — invoking it at
// runtime without qwik-vite throws. We stub the runtime so the adapter
// module evaluates; rendered behavior is covered by adapters.spec.ts.

import { describe, expect, it, vi } from "vitest";

vi.mock("@builder.io/qwik", () => ({
  component$: (fn: unknown) => fn,
  useSignal: () => ({ value: undefined }),
  useStore: <T>(init: T) => init,
  useVisibleTask$: () => undefined,
  Slot: () => null,
}));

describe("@surdeddd/bottom-sheet/qwik", () => {
  it("source module exports a BottomSheet symbol", async () => {
    const mod = await import("../../src/qwik/index");
    expect(mod.BottomSheet).toBeDefined();
    expect(["function", "object"]).toContain(typeof mod.BottomSheet);
  });

  it("does not pollute globalThis with DOM-ish keys at import", async () => {
    await import("../../src/qwik/index");
    // Pure Node import — confirm we never auto-installed a window.
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
    expect((globalThis as { document?: unknown }).document).toBeUndefined();
  });

  it("does not expose React/Solid primitives by mistake", async () => {
    const mod = await import("../../src/qwik/index");
    expect(mod).not.toHaveProperty("createSignal");
    expect(mod).not.toHaveProperty("useSyncExternalStore");
  });
});
