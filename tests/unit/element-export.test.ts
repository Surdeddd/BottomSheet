// @vitest-environment happy-dom
//
// happy-dom (not Node) because the custom element class extends
// HTMLElement at module load time — pure Node throws ReferenceError.

import { describe, expect, it, beforeAll } from "vitest";

beforeAll(async () => {
  // Importing the source module triggers the auto-register side effect
  // (`if (typeof window !== "undefined") customElements.define(...)`). With
  // happy-dom installed, `window` is defined here.
  await import("../../src/web-component/index");
});

describe("@surdeddd/bottom-sheet/element", () => {
  it("auto-registers the <bottom-sheet> custom element on import", () => {
    const ctor = customElements.get("bottom-sheet");
    expect(ctor).toBeDefined();
    expect(ctor).toBeTypeOf("function");
  });

  it("exposes defineBottomSheet for custom-tag-name registration", async () => {
    const mod = await import("../../src/web-component/index");
    expect(mod.defineBottomSheet).toBeTypeOf("function");
    expect(mod.BottomSheetElement).toBeTypeOf("function");
  });

  it("creates an instance via document.createElement and exposes the public API", () => {
    const el = document.createElement("bottom-sheet") as HTMLElement & {
      snapTo?: (id: string) => Promise<void>;
      close?: () => Promise<void>;
      sheetState?: unknown;
    };
    // Sanity: this is an UPGRADED element (custom element class), not the
    // generic `HTMLUnknownElement` fallback we'd get if registration had
    // silently failed.
    expect(el.constructor.name).not.toBe("HTMLUnknownElement");
    // Public imperative API documented on the web-component:
    //   `snapTo`, `close`, and the read-only `sheetState` getter. The
    //   lower-level `dragTo` from the engine is intentionally NOT mirrored
    //   — declarative HTML doesn't need scrub-style imperative drives.
    expect(el.snapTo).toBeTypeOf("function");
    expect(el.close).toBeTypeOf("function");
    // `sheetState` is a getter — null before the engine boots, populated
    // once the element connects to the DOM. Either is acceptable here; we
    // just assert the property exists on the prototype chain.
    expect("sheetState" in el).toBe(true);
  });

  it("defineBottomSheet is idempotent — re-calling does not throw", async () => {
    // The auto-register side-effect already set `registered = true` when
    // `src/web-component/index.ts` was imported in `beforeAll`. Calling
    // `defineBottomSheet()` again must therefore be a no-op — re-defining
    // a custom element is a hard error in the Custom Elements spec, and
    // the guard's job is to prevent that.
    const mod = await import("../../src/web-component/index");
    expect(() => mod.defineBottomSheet()).not.toThrow();
    expect(() => mod.defineBottomSheet("bottom-sheet")).not.toThrow();
  });
});
