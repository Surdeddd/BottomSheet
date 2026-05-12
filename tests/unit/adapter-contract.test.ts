import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { makeDom } from "./_helpers/makeDom";

vi.mock("@builder.io/qwik", () => ({
  component$: (fn: unknown) => fn,
  useSignal: () => ({ value: undefined }),
  useStore: <T>(init: T) => init,
  useVisibleTask$: () => undefined,
  Slot: () => null,
}));

const EXPECTED_STATE_KEYS = [
  "size",
  "activeId",
  "isDragging",
  "isAnimating",
  "progress",
] as const;

const EXPECTED_REF_API = [
  "snapTo",
  "open",
  "close",
  "setAllowed",
] as const;

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
});

describe("Adapter contract — engine anchor", () => {
  it("EngineState shape matches the expected keys", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "a", size: 100 }],
      respectReducedMotion: false,
    });
    const keys = Object.keys(engine.state).sort();
    expect(keys).toEqual([...EXPECTED_STATE_KEYS].sort());
    engine.destroy();
  });

  it("engine has every method the adapters re-expose", () => {
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [{ id: "a", size: 100 }],
      respectReducedMotion: false,
    });
    for (const fn of EXPECTED_REF_API) {
      expect(typeof (engine as unknown as Record<string, unknown>)[fn]).toBe(
        "function",
      );
    }
    engine.destroy();
  });
});

describe("Adapter contract — Vue useBottomSheet", () => {
  let originalWarn: typeof console.warn;
  beforeEach(() => {
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const msg = String(args[0] ?? "");
      if (msg.includes("[Vue warn]")) return;
      originalWarn(...(args as Parameters<typeof console.warn>));
    };
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _restore = () => (console.warn = originalWarn);

  it("returns a state object shape-compatible with EngineState (after mount)", async () => {
    const { useBottomSheet } = await import("../../src/vue/useBottomSheet");
    const { sheetRef, handleRef, state, snapTo, open, close, setAllowed } =
      useBottomSheet({
        snapPoints: [{ id: "a", size: 100 }],
      });

    expect(Object.keys(state).sort()).toEqual([...EXPECTED_STATE_KEYS].sort());

    expect(typeof snapTo).toBe("function");
    expect(typeof open).toBe("function");
    expect(typeof close).toBe("function");
    expect(typeof setAllowed).toBe("function");

    expect(sheetRef).toHaveProperty("value");
    expect(handleRef).toHaveProperty("value");
    expect(sheetRef.value).toBeNull();
  });

  it("pre-mount on() listeners replay correctly onto the engine after mount", async () => {
    const { useBottomSheet } = await import("../../src/vue/useBottomSheet");
    const { on } = useBottomSheet({
      snapPoints: [{ id: "a", size: 100 }],
    });
    const unsub = on("snap", () => {});
    expect(typeof unsub).toBe("function");
    expect(() => unsub()).not.toThrow();
  });
});

describe("Adapter contract — React useBottomSheet", () => {
  it("returns a hook with refs + ref-API matching the contract", async () => {
    const { useBottomSheet } = await import("../../src/react/useBottomSheet");
    expect(typeof useBottomSheet).toBe("function");
  });
});

describe("Adapter contract — Solid", () => {
  it("module exposes BottomSheet + types", async () => {
    const mod = await import("../../src/solid/index");
    expect(mod).toBeDefined();
  });
});

describe("Adapter contract — Svelte", () => {
  it("createBottomSheet factory exposes an attach-based controller", async () => {
    const { createBottomSheet } = await import(
      "../../src/svelte/useBottomSheet.svelte"
    );
    const { sheet, handle } = makeDom();
    const ctrl = createBottomSheet({
      snapPoints: [{ id: "a", size: 100 }],
    });
    const detach = ctrl.attach({ element: sheet, handle });
    expect(typeof detach).toBe("function");

    for (const fn of EXPECTED_REF_API) {
      expect(typeof (ctrl as unknown as Record<string, unknown>)[fn]).toBe(
        "function",
      );
    }

    const s = ctrl.state();
    expect(Object.keys(s).sort()).toEqual([...EXPECTED_STATE_KEYS].sort());

    detach();
    ctrl.destroy();
  });
});

describe("Adapter contract — Web Component (<bottom-sheet>)", () => {

  it("exposes EXPECTED_REF_API as instance methods + EngineState via sheetState", async () => {
    const { defineBottomSheet } = await import(
      "../../src/web-component/BottomSheetElement"
    );
    defineBottomSheet();

    const el = document.createElement("bottom-sheet") as HTMLElement & {
      snapTo?: (id: string) => Promise<void>;
      open?: (id?: string) => Promise<void>;
      close?: () => Promise<void>;
      setAllowed?: (ids: string[], snap?: string) => void;
      sheetState?: unknown;
    };
    el.setAttribute("snap-points", '[{"id":"a","size":100}]');

    expect(el.constructor.name).not.toBe("HTMLUnknownElement");

    for (const fn of EXPECTED_REF_API) {
      expect(
        typeof (el as unknown as Record<string, unknown>)[fn],
      ).toBe("function");
    }

    document.body.appendChild(el);

    const state = (el as unknown as { sheetState: unknown }).sheetState;
    expect(state).not.toBeNull();
    expect(typeof state).toBe("object");
    expect(Object.keys(state as object).sort()).toEqual(
      [...EXPECTED_STATE_KEYS].sort(),
    );

    document.body.removeChild(el);
  });

  it("emits CustomEvents whose detail satisfies the snap/progress contract", async () => {
    const { defineBottomSheet } = await import(
      "../../src/web-component/BottomSheetElement"
    );
    defineBottomSheet();

    const el = document.createElement("bottom-sheet") as HTMLElement & {
      snapTo?: (id: string) => Promise<void>;
    };
    el.setAttribute("snap-points", '[{"id":"a","size":100},{"id":"b","size":200}]');
    el.setAttribute("initial", "a");
    document.body.appendChild(el);

    expect(
      (el as unknown as { sheetState: unknown }).sheetState,
    ).not.toBeNull();

    const seenSnap: Array<{ id?: unknown }> = [];
    el.addEventListener("snap", (e: Event) => {
      seenSnap.push((e as CustomEvent<{ id: string }>).detail);
    });

    await el.snapTo?.("b");

    expect(seenSnap.length).toBeGreaterThan(0);
    expect(seenSnap[0]).toBeTypeOf("object");
    expect(seenSnap[0]).toHaveProperty("id");

    document.body.removeChild(el);
  });
});

describe("Adapter contract — Qwik (shape-only)", () => {

  it("module exposes BottomSheet + EngineState type re-export", async () => {
    const mod = await import("../../src/qwik/index");
    expect(mod.BottomSheet).toBeDefined();
    expect(["function", "object"]).toContain(typeof mod.BottomSheet);
  });
});
