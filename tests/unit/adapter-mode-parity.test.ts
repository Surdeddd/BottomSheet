// @vitest-environment happy-dom

import { describe, expect, it, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string): string =>
  readFileSync(resolve(here, "../../src", rel), "utf8");

describe("every adapter forwards a mode change to the engine", () => {
  it.each([
    ["react", "react/BottomSheet.tsx"],
    ["vue", "vue/BottomSheet.vue"],
    ["svelte", "svelte/BottomSheet.svelte"],
    ["solid", "solid/index.tsx"],
    ["qwik", "qwik/index.tsx"],
  ])("%s calls setMode when the prop changes", (_name, file) => {
    expect(src(file)).toContain("setMode");
  });

  it("the web component treats mode as a live attribute", async () => {
    const attrs = await import("../../src/web-component/attributes");
    expect(attrs.LIVE_ATTRS.has(attrs.ATTR_MODE)).toBe(true);
    expect(attrs.OBSERVED_ATTRS).toContain(attrs.ATTR_MODE);
  });
});

describe("<bottom-sheet> follows its mode attribute without a rebuild", () => {
  beforeAll(async () => {
    await import("../../src/web-component/index");
  });

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  const mount = (): HTMLElement & {
    getEngine: () => {
      getMode: () => string;
      state: { activeId: string };
      snapTo: (id: string) => Promise<void>;
    } | null;
  } => {
    const el = document.createElement("bottom-sheet");
    el.setAttribute(
      "snap-points",
      JSON.stringify([
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ]),
    );
    el.setAttribute("initial", "closed");
    el.setAttribute("animation", "tween");
    el.setAttribute("duration", "0");
    el.setAttribute("mode", "bottom");
    document.body.appendChild(el);
    return el as never;
  };

  it("switches the engine to the new edge", () => {
    const el = mount();
    expect(el.getEngine()?.getMode()).toBe("bottom");

    el.setAttribute("mode", "right");

    expect(el.getEngine()?.getMode()).toBe("right");
    el.remove();
  });

  it("keeps the same engine instance instead of tearing it down", () => {
    const el = mount();
    const before = el.getEngine();

    el.setAttribute("mode", "left");

    expect(el.getEngine()).toBe(before);
    el.remove();
  });

  it("keeps the active snap point across the change", async () => {
    const el = mount();
    await el.getEngine()?.snapTo("full");

    el.setAttribute("mode", "top");

    expect(el.getEngine()?.state.activeId).toBe("full");
    expect(el.getEngine()?.getMode()).toBe("top");
    el.remove();
  });

  it("falls back to bottom for a value the element does not know", () => {
    const el = mount();

    el.setAttribute("mode", "diagonal");

    expect(el.getEngine()?.getMode()).toBe("bottom");
    el.remove();
  });
});

describe("Qwik <BottomSheet> forwards mode through its tracked task", () => {
  it("calls setMode with the value the task tracked", async () => {
    const tasks: Array<
      (ctx: { track: (fn: () => unknown) => unknown }) => void
    > = [];
    const setMode = vi.fn();
    const engine = new Proxy(
      { setMode },
      {
        get: (target: Record<string, unknown>, key: string) =>
          key in target ? target[key] : vi.fn(),
      },
    );

    vi.resetModules();
    vi.doMock("@builder.io/qwik", () => ({
      component$: (fn: unknown) => fn,
      useSignal: () => ({ value: undefined }),
      useStore: () => ({ engine }),
      useVisibleTask$: () => undefined,
      useTask$: (
        fn: (ctx: { track: (f: () => unknown) => unknown }) => void,
      ) => {
        tasks.push(fn);
      },
      Slot: () => null,
    }));

    const mod = await import("../../src/qwik/index");
    const props = {
      mode: "right",
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
    };
    try {
      (mod.BottomSheet as unknown as (p: unknown) => unknown)(props);
    } catch {
      void 0;
    }

    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      try {
        task({ track: (fn: () => unknown) => fn() });
      } catch {
        continue;
      }
    }

    vi.doUnmock("@builder.io/qwik");
    vi.resetModules();

    expect(setMode).toHaveBeenCalledWith("right");
  });
});
