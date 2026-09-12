import { describe, expect, it, beforeEach } from "vitest";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { jsx } from "react/jsx-runtime";
import { parse, compileScript } from "@vue/compiler-sfc";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { transformSync } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as vue from "vue";
import * as composable from "../../src/vue/useBottomSheet";
import { BottomSheet as ReactBottomSheet } from "../../src/react/BottomSheet";
import type { BottomSheetHandle } from "../../src/react/BottomSheet";
import type { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const here = dirname(fileURLToPath(import.meta.url));
const sfcPath = resolve(here, "../../src/vue/BottomSheet.vue");

const modules: Record<string, unknown> = {
  vue,
  "./useBottomSheet": composable,
};

function loadSfc(): unknown {
  const src = readFileSync(sfcPath, "utf8");
  const { descriptor } = parse(src, { filename: sfcPath });
  const compiled = compileScript(descriptor, {
    id: "bs-mode-test",
    inlineTemplate: true,
    fs: {
      fileExists: f => existsSync(f),
      readFile: f => (existsSync(f) ? readFileSync(f, "utf8") : undefined),
      realpath: f => realpathSync(f),
    },
  });
  const js = transformSync(compiled.content, {
    loader: "ts",
    format: "cjs",
    target: "es2020",
  }).code;
  const shim = (id: string): unknown => {
    if (id in modules) return modules[id];
    throw new Error(`unexpected import in Vue SFC: ${id}`);
  };
  const mod = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", js)(shim, mod, mod.exports);
  return mod.exports.default ?? mod.exports;
}

const Cmp = loadSfc();

const flush = async (): Promise<void> => {
  await vue.nextTick();
  await new Promise(r => setTimeout(r, 40));
};

type Exposed = { getEngine: () => BottomSheetEngine | null };

const mountWithMode = async (mode: string) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const outerMode = vue.ref(mode);
  const app = vue.createApp({
    render: () =>
      vue.h(Cmp as never, {
        mode: outerMode.value,
        snapPoints: [
          { id: "closed", size: 0 },
          { id: "full", size: 400 },
        ],
        initial: "closed",
        animation: "tween",
        duration: 0,
        respectReducedMotion: false,
        teleport: false,
        ref: "sheet",
      }),
  });
  const vm = app.mount(host) as unknown as {
    $refs: { sheet: Exposed };
  };
  await flush();
  return { app, host, outerMode, vm };
};

describe("Vue <BottomSheet> keeps the engine in step with the mode prop", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("switches the engine to the new physical edge", async () => {
    const { app, host, outerMode, vm } = await mountWithMode("bottom");
    expect(vm.$refs.sheet.getEngine()?.getMode()).toBe("bottom");

    outerMode.value = "right";
    await flush();

    expect(vm.$refs.sheet.getEngine()?.getMode()).toBe("right");

    app.unmount();
    host.remove();
  });

  it("marks the sheet element with the mode the engine actually uses", async () => {
    const { app, host, outerMode, vm } = await mountWithMode("bottom");

    outerMode.value = "left";
    await flush();

    const engine = vm.$refs.sheet.getEngine();
    expect(engine?.getMode()).toBe("left");
    expect(host.querySelector<HTMLElement>(".bs-sheet")?.dataset.mode).toBe(
      "left",
    );

    app.unmount();
    host.remove();
  });

  it("keeps the active snap point when the mode prop changes", async () => {
    const { app, host, outerMode, vm } = await mountWithMode("bottom");
    const engine = vm.$refs.sheet.getEngine();
    await engine?.open("full");
    await flush();

    outerMode.value = "right";
    await flush();

    expect(vm.$refs.sheet.getEngine()?.state.activeId).toBe("full");

    app.unmount();
    host.remove();
  });

  it("survives switching back and forth", async () => {
    const { app, host, outerMode, vm } = await mountWithMode("bottom");

    for (const next of ["left", "top", "right", "bottom"]) {
      outerMode.value = next;
      await flush();
      expect(vm.$refs.sheet.getEngine()?.getMode()).toBe(next);
    }

    app.unmount();
    host.remove();
  });

  it("resolves a logical mode against the document direction", async () => {
    document.documentElement.setAttribute("dir", "rtl");
    const { app, host, outerMode, vm } = await mountWithMode("bottom");

    outerMode.value = "start";
    await flush();

    expect(vm.$refs.sheet.getEngine()?.getMode()).toBe("right");

    document.documentElement.removeAttribute("dir");
    app.unmount();
    host.remove();
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("React <BottomSheet> keeps the engine in step with the mode prop", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  const render = async (mode: string, ref: { current: BottomSheetHandle | null }) => {
    await act(async () => {
      root.render(
        jsx(ReactBottomSheet, {
          ref,
          mode: mode as never,
          snapPoints: [
            { id: "closed", size: 0 },
            { id: "full", size: 400 },
          ],
          initial: "closed",
          animation: "tween",
          duration: 0,
          respectReducedMotion: false,
          teleport: false,
          children: null,
        }),
      );
    });
  };

  it("switches the engine to the new physical edge", async () => {
    const ref = createRef<BottomSheetHandle>();
    await render("bottom", ref);
    expect(ref.current?.getEngine()?.getMode()).toBe("bottom");

    await render("right", ref);

    expect(ref.current?.getEngine()?.getMode()).toBe("right");
    await act(async () => root.unmount());
  });

  it("survives switching back and forth", async () => {
    const ref = createRef<BottomSheetHandle>();
    await render("bottom", ref);

    for (const next of ["left", "top", "right", "bottom"]) {
      await render(next, ref);
      expect(ref.current?.getEngine()?.getMode()).toBe(next);
    }

    await act(async () => root.unmount());
  });

  it("keeps the active snap point when the mode prop changes", async () => {
    const ref = createRef<BottomSheetHandle>();
    await render("bottom", ref);
    await act(async () => {
      await ref.current?.open("full");
    });

    await render("left", ref);

    expect(ref.current?.getEngine()?.state.activeId).toBe("full");
    await act(async () => root.unmount());
  });
});
