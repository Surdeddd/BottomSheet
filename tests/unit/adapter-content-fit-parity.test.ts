// @vitest-environment happy-dom

import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
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
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string): string =>
  readFileSync(resolve(here, "../../src", rel), "utf8");

const points = [
  { id: "closed", size: 0 },
  { id: "half", size: 300 },
  { id: "full", size: 600 },
];

const reset = (): void => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
};

describe("adapters with an explicit prop list declare and forward fitContentToSnap", () => {
  it.each([
    ["svelte component", "svelte/BottomSheet.svelte"],
    ["solid", "solid/index.tsx"],
    ["qwik", "qwik/index.tsx"],
  ])("%s", (_name, file) => {
    const text = src(file);
    expect(text).toMatch(/fitContentToSnap\?: boolean/);
    expect(text.match(/fitContentToSnap/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("svelte's public declaration lists it", () => {
    expect(src("svelte/index.d.ts.template")).toMatch(
      /fitContentToSnap\?: boolean/,
    );
  });

  it("the web component observes fit-content-to-snap", async () => {
    const attrs = await import("../../src/web-component/attributes");
    expect(attrs.OBSERVED_ATTRS).toContain("fit-content-to-snap");
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("React <BottomSheet fitContentToSnap>", () => {
  beforeEach(reset);

  it("reaches the engine and marks the sheet", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const ref = createRef<BottomSheetHandle>();
    await act(async () => {
      root.render(
        jsx(ReactBottomSheet, {
          ref,
          fitContentToSnap: true,
          snapPoints: points,
          initial: "closed",
          animation: "tween",
          duration: 0,
          respectReducedMotion: false,
          teleport: false,
          children: null,
        } as never),
      );
    });

    const sheet = host.querySelector<HTMLElement>(".bs-sheet");
    expect(sheet?.hasAttribute("data-bs-fit-content")).toBe(true);
    await act(async () => root.unmount());
  });

  it("stays off when the prop is absent", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        jsx(ReactBottomSheet, {
          snapPoints: points,
          initial: "closed",
          animation: "tween",
          duration: 0,
          teleport: false,
          children: null,
        } as never),
      );
    });

    const sheet = host.querySelector<HTMLElement>(".bs-sheet");
    expect(sheet?.hasAttribute("data-bs-fit-content")).toBe(false);
    await act(async () => root.unmount());
  });
});

const sfcPath = resolve(here, "../../src/vue/BottomSheet.vue");

function loadSfc(): unknown {
  const text = readFileSync(sfcPath, "utf8");
  const { descriptor } = parse(text, { filename: sfcPath });
  const compiled = compileScript(descriptor, {
    id: "bs-fit-test",
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
  const modules: Record<string, unknown> = {
    vue,
    "./useBottomSheet": composable,
  };
  const shim = (id: string): unknown => {
    if (id in modules) return modules[id];
    throw new Error(`unexpected import in Vue SFC: ${id}`);
  };
  const mod = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", js)(shim, mod, mod.exports);
  return mod.exports.default ?? mod.exports;
}

describe("Vue <BottomSheet fit-content-to-snap>", () => {
  beforeEach(reset);

  it("reaches the engine and marks the sheet", async () => {
    const Cmp = loadSfc();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = vue.createApp(Cmp as never, {
      fitContentToSnap: true,
      snapPoints: points,
      initial: "closed",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
      teleport: false,
    });
    app.mount(host);
    await vue.nextTick();
    await new Promise(r => setTimeout(r, 40));

    const sheet = host.querySelector<HTMLElement>(".bs-sheet");
    expect(sheet?.hasAttribute("data-bs-fit-content")).toBe(true);
    app.unmount();
  });
});

describe("<bottom-sheet fit-content-to-snap>", () => {
  beforeAll(async () => {
    await import("../../src/web-component/index");
  });
  beforeEach(reset);

  const mount = (withFit: boolean): HTMLElement => {
    const el = document.createElement("bottom-sheet");
    el.setAttribute("snap-points", JSON.stringify(points));
    el.setAttribute("initial", "closed");
    el.setAttribute("animation", "tween");
    el.setAttribute("duration", "0");
    if (withFit) el.setAttribute("fit-content-to-snap", "");
    document.body.appendChild(el);
    return el;
  };

  const sheetOf = (el: HTMLElement): HTMLElement | null =>
    (el.shadowRoot ?? el).querySelector<HTMLElement>(".bs-sheet");

  it("turns the feature on from the attribute", () => {
    const el = mount(true);
    expect(sheetOf(el)?.hasAttribute("data-bs-fit-content")).toBe(true);
  });

  it("treats an explicit false as off", () => {
    const el = document.createElement("bottom-sheet");
    el.setAttribute("snap-points", JSON.stringify(points));
    el.setAttribute("initial", "closed");
    el.setAttribute("fit-content-to-snap", "false");
    document.body.appendChild(el);
    expect(sheetOf(el)?.hasAttribute("data-bs-fit-content")).toBe(false);
  });

  it("stays off without the attribute", () => {
    const el = mount(false);
    expect(sheetOf(el)?.hasAttribute("data-bs-fit-content")).toBe(false);
  });
});
