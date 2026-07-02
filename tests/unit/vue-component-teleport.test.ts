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
    id: "bs-teleport-test",
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

const mountSheet = (props: Record<string, unknown>) => {
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
    ...props,
  });
  app.mount(host);
  return { app, host };
};

const flush = async (): Promise<void> => {
  await vue.nextTick();
  await new Promise(r => setTimeout(r, 20));
};

describe("Vue <BottomSheet> teleport", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("default (teleport true): .bs-sheet lives under body inside the teleported .bs-root, no engine-level rip-out", async () => {
    const { app, host } = mountSheet({});
    await flush();

    const root = document.querySelector(".bs-root")!;
    const sheet = document.querySelector(".bs-sheet")!;
    const backdrop = document.querySelector(".bs-backdrop")!;
    const screen = document.querySelector(".bs-screen")!;

    expect(root.parentElement).toBe(document.body);
    expect(host.contains(root)).toBe(false);

    expect(sheet.parentElement).toBe(root);
    expect(backdrop.parentElement).toBe(root);
    expect(screen.parentElement).toBe(root);

    app.unmount();
    host.remove();
  });

  it('teleport="false": .bs-root stays in place', async () => {
    const { app, host } = mountSheet({ teleport: false });
    await flush();

    const root = document.querySelector(".bs-root")!;
    expect(host.contains(root)).toBe(true);
    expect(root.parentElement).not.toBe(document.body);

    const sheet = document.querySelector(".bs-sheet")!;
    expect(sheet.parentElement).toBe(root);

    app.unmount();
    host.remove();
  });
});
