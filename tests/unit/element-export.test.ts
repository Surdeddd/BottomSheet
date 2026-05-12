// @vitest-environment happy-dom

import { describe, expect, it, beforeAll } from "vitest";

beforeAll(async () => {
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
    expect(el.constructor.name).not.toBe("HTMLUnknownElement");
    expect(el.snapTo).toBeTypeOf("function");
    expect(el.close).toBeTypeOf("function");
    expect("sheetState" in el).toBe(true);
  });

  it("defineBottomSheet is idempotent — re-calling does not throw", async () => {
    const mod = await import("../../src/web-component/index");
    expect(() => mod.defineBottomSheet()).not.toThrow();
    expect(() => mod.defineBottomSheet("bottom-sheet")).not.toThrow();
  });
});
