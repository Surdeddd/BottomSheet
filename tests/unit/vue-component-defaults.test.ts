import { describe, it, expect, beforeEach, vi } from "vitest";
import { parse, compileScript } from "@vue/compiler-sfc";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { transformSync } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as vue from "vue";
import { renderToString } from "vue/server-renderer";
import * as composable from "../../src/vue/useBottomSheet";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";

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
    id: "bs-defaults-test",
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

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const flush = async (): Promise<void> => {
  await vue.nextTick();
  await wait(40);
};

const points = [
  { id: "closed", size: 0 },
  { id: "half", size: 300 },
  { id: "full", size: 600 },
];

type Exposed = {
  getEngine: () => BottomSheetEngine | null;
  open: () => Promise<void>;
  snapTo: (id: string) => Promise<void>;
};

const mount = (props: Record<string, unknown>) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = vue.createApp(Cmp as never, {
    snapPoints: points,
    teleport: false,
    ...props,
  });
  const vm = app.mount(host) as unknown as Exposed;
  return { app, vm, host };
};

const internals = (engine: BottomSheetEngine) => {
  const raw = engine as unknown as {
    rubberBandEnabled: boolean;
    dragFromContentDefault: boolean;
    lifecycle: { closeOnEscape: boolean; bodyScrollLockEnabled: boolean };
    animation: { respectReducedMotion: boolean };
  };
  return {
    rubberBand: raw.rubberBandEnabled,
    dragFromContent: raw.dragFromContentDefault,
    closeOnEscape: raw.lifecycle.closeOnEscape,
    lockBodyScroll: raw.lifecycle.bodyScrollLockEnabled,
    respectReducedMotion: raw.animation.respectReducedMotion,
  };
};

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  __resetRouteCoordinatorForTests();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  document.body.removeAttribute("style");
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
});

describe("Vue <BottomSheet> engine defaults", () => {
  it("leaves every option it was not given to the engine's own default", async () => {
    const plain = document.createElement("section");
    document.body.appendChild(plain);
    const reference = new BottomSheetEngine({
      element: plain,
      snapPoints: points,
      initial: "closed",
    });
    const expected = internals(reference);
    reference.destroy();

    const { app, vm } = mount({ initial: "closed" });
    await flush();
    expect(internals(vm.getEngine()!)).toEqual(expected);
    app.unmount();
  });

  it("names the handle and the content from props", async () => {
    const { app, host } = mount({
      initial: "half",
      handleLabel: "Изменить размер",
      contentLabel: "Содержимое",
    });
    await flush();
    expect(host.querySelector(".bs-handle")!.getAttribute("aria-label")).toBe(
      "Изменить размер",
    );
    expect(host.querySelector(".bs-content")!.getAttribute("aria-label")).toBe(
      "Содержимое",
    );
    app.unmount();
  });

  it("locks the page and closes on Escape without being asked to", async () => {
    const { app, vm } = mount({
      initial: "half",
      animation: "tween",
      duration: 0,
    });
    await flush();
    expect(document.body.style.position).toBe("fixed");

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flush();
    expect(vm.getEngine()!.state.size).toBe(0);
    app.unmount();
  });

  it("still honours an explicit false", async () => {
    const { app } = mount({ initial: "half", lockBodyScroll: false });
    await flush();
    expect(document.body.style.position).toBe("");
    app.unmount();
  });
});

describe("Vue <BottomSheet> controlled open", () => {
  const reversed = [
    { id: "full", size: 600 },
    { id: "closed", size: 0 },
  ];

  it("starts at the closed point when open is false, wherever that point is listed", async () => {
    const onClose = vi.fn();
    const { app, vm, host } = mount({
      snapPoints: reversed,
      open: false,
      animation: "tween",
      duration: 0,
      onClose,
    });
    await flush();
    expect(vm.getEngine()!.state.size).toBe(0);
    expect(vm.getEngine()!.state.phase).toBe("closed");
    expect(onClose).not.toHaveBeenCalled();
    expect(host.querySelector(".bs-sheet")!.getAttribute("data-bs-rest")).toBe(
      "closed",
    );
    app.unmount();
  });

  it("starts at the point named by snap when initial is not given", async () => {
    const { app, vm } = mount({ snap: "full", animation: "tween" });
    await vue.nextTick();
    expect(vm.getEngine()!.state.activeId).toBe("full");
    expect(vm.getEngine()!.state.isAnimating).toBe(false);
    app.unmount();
  });

  it("stays closed when open is false and snap names an open point", async () => {
    const { app, vm } = mount({
      open: false,
      snap: "full",
      animation: "tween",
      duration: 0,
    });
    await flush();
    expect(vm.getEngine()!.state.phase).toBe("closed");
    app.unmount();
  });

  it("renders that sheet hidden on the server", async () => {
    const html = await renderToString(
      vue.createSSRApp(Cmp as never, {
        snapPoints: reversed,
        open: false,
        teleport: false,
      }),
    );
    expect(html).toContain('data-bs-rest="closed"');
  });
});

describe("Vue <BottomSheet> events and props", () => {
  it("calls a snap listener once per snap", async () => {
    const onSnap = vi.fn();
    const { app, vm } = mount({
      initial: "half",
      animation: "tween",
      duration: 0,
      onSnap,
    });
    await flush();
    onSnap.mockClear();
    await vm.snapTo("full");
    await flush();
    expect(onSnap).toHaveBeenCalledTimes(1);
    expect(onSnap).toHaveBeenCalledWith("full");
    app.unmount();
  });

  it("follows the open prop when it is reversed before the sheet has landed", async () => {
    const open = vue.ref(false);
    const reported: boolean[] = [];
    let exposed: Exposed | null = null;
    const Parent = vue.defineComponent({
      setup() {
        return () =>
          vue.h(Cmp as never, {
            ref: (el: unknown) => {
              exposed = el as Exposed | null;
            },
            snapPoints: points,
            initial: "closed",
            teleport: false,
            animation: "tween",
            duration: 300,
            respectReducedMotion: false,
            open: open.value,
            "onUpdate:open": (value: boolean) => reported.push(value),
          });
      },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = vue.createApp(Parent);
    app.mount(host);
    await flush();

    open.value = true;
    await vue.nextTick();
    await wait(80);
    open.value = false;
    await vue.nextTick();
    await wait(700);

    expect(exposed!.getEngine()!.state.size).toBe(0);
    expect(exposed!.getEngine()!.state.phase).toBe("closed");
    expect(reported[reported.length - 1]).toBe(false);
    app.unmount();
  });

  it("does not reset the snap points when the parent re-renders with the same list", async () => {
    const label = vue.ref("one");
    const size = vue.ref(600);
    let exposed: Exposed | null = null;
    const Parent = vue.defineComponent({
      setup() {
        return () =>
          vue.h(Cmp as never, {
            ref: (el: unknown) => {
              exposed = el as Exposed | null;
            },
            snapPoints: [
              { id: "closed", size: 0 },
              { id: "half", size: 300 },
              { id: "full", size: size.value },
            ],
            initial: "half",
            teleport: false,
            ariaLabel: label.value,
          });
      },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = vue.createApp(Parent);
    app.mount(host);
    await flush();

    const spy = vi.spyOn(exposed!.getEngine()!, "setSnapPoints");
    label.value = "two";
    await flush();
    expect(spy).not.toHaveBeenCalled();

    size.value = 700;
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    app.unmount();
  });

  it("writes the physical edge to data-mode for logical modes", async () => {
    const mode = vue.ref("start");
    const Parent = vue.defineComponent({
      setup() {
        return () =>
          vue.h(
            Cmp as never,
            {
              snapPoints: points,
              initial: "half",
              teleport: false,
              mode: mode.value,
            },
            { "button-left": () => vue.h("button", "left") },
          );
      },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = vue.createApp(Parent);
    app.mount(host);
    await flush();

    const sheet = host.querySelector<HTMLElement>(".bs-sheet")!;
    const slot = host.querySelector<HTMLElement>(".bs-button-slot")!;
    expect(sheet.dataset.mode).toBe("left");
    expect(slot.dataset.mode).toBe("left");

    mode.value = "end";
    await flush();
    expect(sheet.dataset.mode).toBe("right");
    expect(slot.dataset.mode).toBe("right");
    app.unmount();
  });
});

describe("Vue server markup", () => {
  it("marks a sheet that starts closed as resting closed", async () => {
    const html = await renderToString(
      vue.createSSRApp(Cmp as never, {
        snapPoints: points,
        initial: "closed",
        teleport: false,
      }),
    );
    expect(html).toContain('data-bs-rest="closed"');
  });

  it("does not mark a sheet that starts open", async () => {
    const html = await renderToString(
      vue.createSSRApp(Cmp as never, {
        snapPoints: points,
        initial: "half",
        teleport: false,
      }),
    );
    expect(html).not.toContain("data-bs-rest");
  });
});
