import { describe, it, expect, beforeEach } from "vitest";
import { parse, compileScript } from "@vue/compiler-sfc";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { transformSync } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as vue from "vue";
import * as composable from "../../src/vue/useBottomSheet";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

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
    id: "bs-events-test",
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
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("require", "module", "exports", js)(shim, mod, mod.exports);
  return mod.exports.default ?? mod.exports;
}

const Cmp = loadSfc();

const flush = async (): Promise<void> => {
  await vue.nextTick();
  await new Promise(r => setTimeout(r, 40));
};

describe("Vue <BottomSheet> drag/progress emits", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("open() emits progress (non-empty) and fires open + opened", async () => {
    const progressEvents: Array<{ value: number; size: number }> = [];
    const openEvents: string[] = [];
    const openedEvents: string[] = [];

    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = vue.createApp(Cmp as never, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      teleport: false,
      onProgress: (p: { value: number; size: number }) =>
        progressEvents.push(p),
      onOpen: (id: string) => openEvents.push(id),
      onOpened: (id: string) => openedEvents.push(id),
    });
    const vm = app.mount(host) as unknown as { open: () => Promise<void> };
    await flush();

    await vm.open();
    await flush();

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents.at(-1)?.size).toBe(400);
    expect(openEvents.length).toBeGreaterThan(0);
    expect(openedEvents.length).toBeGreaterThan(0);

    app.unmount();
    host.remove();
  });

  it("declares drag + progress in its emits so v-on binds them", () => {
    const emits = (Cmp as { emits?: unknown }).emits;
    const list = Array.isArray(emits)
      ? emits
      : emits && typeof emits === "object"
        ? Object.keys(emits as object)
        : [];
    expect(list).toContain("drag");
    expect(list).toContain("progress");
  });

  it("open=true at mount opens the sheet", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = vue.createApp(Cmp as never, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      open: true,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      teleport: false,
    });
    const vm = app.mount(host) as unknown as { state: { size: number } };
    await flush();

    expect(vm.state.size).toBeGreaterThan(0);

    app.unmount();
    host.remove();
  });

  it("open stays false at mount when not requested", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = vue.createApp(Cmp as never, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      teleport: false,
    });
    const vm = app.mount(host) as unknown as { state: { size: number } };
    await flush();

    expect(vm.state.size).toBe(0);

    app.unmount();
    host.remove();
  });
});
