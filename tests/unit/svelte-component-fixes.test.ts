import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { compile, compileModule } from "svelte/compiler";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const here = dirname(fileURLToPath(import.meta.url));
const sfcPath = resolve(here, "../../src/svelte/BottomSheet.svelte");
const tmpPath = resolve(here, "../../src/svelte/__fixes.gen.js");
const statePath = resolve(here, "../../src/svelte/__fixes-state.gen.js");
const serverPath = resolve(here, "../../src/svelte/__fixes-server.gen.js");
const clientPath = resolve(
  here,
  "../../node_modules/svelte/src/index-client.js",
);
const internalClientPath = resolve(
  here,
  "../../node_modules/svelte/src/internal/client/index.js",
);

type Engine = {
  state: { size: number; phase: string };
};
type SheetInstance = { getEngine: () => Engine | null };
type MountFn = (
  component: unknown,
  options: { target: HTMLElement; props: Record<string, unknown> },
) => SheetInstance;

let Cmp: unknown;
let mount: MountFn;
let unmount: (instance: unknown) => void;
let flushSync: () => void;
let makeProps: (initial: Record<string, unknown>) => Record<string, unknown>;

beforeAll(async () => {
  for (const file of [tmpPath, statePath, serverPath]) {
    rmSync(file, { force: true });
  }
  const client = (await import(pathToFileURL(clientPath).href)) as {
    mount: MountFn;
    unmount: typeof unmount;
    flushSync: typeof flushSync;
  };
  mount = client.mount;
  unmount = client.unmount;
  flushSync = client.flushSync;

  const source = readFileSync(sfcPath, "utf8");
  const { js } = compile(source, {
    filename: "BottomSheet.svelte",
    generate: "client",
    dev: false,
  });
  writeFileSync(
    tmpPath,
    js.code
      .replace(/from\s*["']svelte["']/g, `from ${JSON.stringify(clientPath)}`)
      .replace(
        /from\s*["']svelte\/internal\/client["']/g,
        `from ${JSON.stringify(internalClientPath)}`,
      ),
    "utf8",
  );
  Cmp = (await import(pathToFileURL(tmpPath).href)).default;

  const stateModule = compileModule(
    "export const makeProps = initial => { const props = $state(initial); return props; };",
    { filename: "fixes-state.svelte.js", generate: "client", dev: false },
  );
  writeFileSync(
    statePath,
    stateModule.js.code.replace(
      /from\s*["']svelte\/internal\/client["']/g,
      `from ${JSON.stringify(internalClientPath)}`,
    ),
    "utf8",
  );
  makeProps = (await import(pathToFileURL(statePath).href)).makeProps;
});

afterAll(() => {
  for (const file of [tmpPath, statePath, serverPath]) {
    rmSync(file, { force: true });
  }
});

const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

const baseProps = (extra: Record<string, unknown>): Record<string, unknown> => ({
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "full", size: 400 },
  ],
  initial: "closed",
  teleport: false,
  animation: "tween",
  ...extra,
});

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  document.body.removeAttribute("style");
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
});

describe("Svelte <BottomSheet> engine options", () => {
  it("passes options it does not name itself through to the engine", async () => {
    const sibling = document.createElement("main");
    document.body.appendChild(sibling);
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = makeProps(
      baseProps({
        initial: "full",
        duration: 0,
        inertSiblings: true,
        scrimPreset: "cinematic",
      }),
    );
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);
    expect(sibling.hasAttribute("inert")).toBe(true);
    expect(
      target.querySelector<HTMLElement>(".bs-screen")!.style.background,
    ).toContain("rgba(0, 0, 0, 0.7)");
    unmount(instance);
  });

  it("names the handle and the content from props", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = makeProps(
      baseProps({
        initial: "full",
        handleLabel: "Изменить размер",
        contentLabel: "Содержимое",
      }),
    );
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);
    expect(
      target.querySelector(".bs-handle")!.getAttribute("aria-label"),
    ).toBe("Изменить размер");
    expect(
      target.querySelector(".bs-content")!.getAttribute("aria-label"),
    ).toBe("Содержимое");
    unmount(instance);
  });
});

describe("Svelte <BottomSheet> fixes", () => {
  it("follows open when it is reversed before the sheet has landed", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = makeProps(baseProps({ open: false }));
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);

    props.open = true;
    flushSync();
    await wait(60);
    props.open = false;
    flushSync();
    await wait(700);

    expect(instance.getEngine()!.state.size).toBe(0);
    expect(instance.getEngine()!.state.phase).toBe("closed");
    expect(props.open).toBe(false);
    unmount(instance);
  });

  it("starts at the closed point when open is false, wherever that point is listed", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    let closes = 0;
    const props = makeProps({
      snapPoints: [
        { id: "full", size: 400 },
        { id: "closed", size: 0 },
      ],
      open: false,
      teleport: false,
      animation: "tween",
      duration: 0,
      onclose: () => {
        closes += 1;
      },
    });
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);
    expect(instance.getEngine()!.state.size).toBe(0);
    expect(instance.getEngine()!.state.phase).toBe("closed");
    expect(closes).toBe(0);
    unmount(instance);
  });

  it("starts at the point named by snap when initial is not given", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = makeProps({
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 200 },
        { id: "full", size: 400 },
      ],
      snap: "full",
      teleport: false,
      animation: "tween",
    });
    const instance = mount(Cmp, { target, props });
    flushSync();
    const engine = instance.getEngine() as unknown as {
      state: { activeId: string; isAnimating: boolean };
    };
    expect(engine.state.activeId).toBe("full");
    expect(engine.state.isAnimating).toBe(false);
    unmount(instance);
  });

  it("stays closed when open is false and snap names an open point", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = makeProps(
      baseProps({ initial: undefined, open: false, snap: "full", duration: 0 }),
    );
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);
    expect(instance.getEngine()!.state.phase).toBe("closed");
    unmount(instance);
  });

  it("paints the backdrop with backdropColor, not the scrim layer", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = makeProps(
      baseProps({
        initial: "full",
        duration: 0,
        backdropColor: "rgba(0, 0, 0, 0.2)",
      }),
    );
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);
    const colour = (): string =>
      target
        .querySelector<HTMLElement>(".bs-backdrop")!
        .style.getPropertyValue("--bs-backdrop-color");
    expect(colour()).toBe("rgba(0, 0, 0, 0.2)");
    expect(
      target.querySelector<HTMLElement>(".bs-screen")!.style.background,
    ).toBe("");

    props.backdropColor = "transparent";
    flushSync();
    await wait(40);
    expect(colour()).toBe("transparent");
    unmount(instance);
  });

  it("treats backdropOpacity as the opacity the backdrop reaches", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = makeProps({
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: 200 },
        { id: "full", size: 400 },
      ],
      initial: "half",
      teleport: false,
      animation: "tween",
      duration: 0,
      backdropOpacity: 0.5,
    });
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);
    const shown = (): number =>
      parseFloat(
        target.querySelector<HTMLElement>(".bs-backdrop")!.style.opacity,
      );
    expect(shown()).toBeCloseTo(0.25, 3);

    props.backdropOpacity = 0.2;
    flushSync();
    await wait(40);
    expect(shown()).toBeCloseTo(0.1, 3);
    unmount(instance);
  });

  it("hands the drag payloads to ondragstart and ondragend", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const seen: Array<[string, unknown]> = [];
    const props = makeProps(
      baseProps({
        initial: "full",
        duration: 0,
        ondragstart: (payload: unknown) => seen.push(["start", payload]),
        ondragend: (payload: unknown) => seen.push(["end", payload]),
      }),
    );
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);
    const handle = target.querySelector<HTMLElement>(".bs-handle")!;
    const fire = (type: string, clientY: number): void => {
      handle.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: 100,
          clientY,
        }),
      );
    };
    fire("pointerdown", 600);
    fire("pointermove", 640);
    fire("pointermove", 680);
    fire("pointerup", 680);
    await wait(40);
    const start = seen.find(([kind]) => kind === "start")?.[1] as
      | { size: number }
      | undefined;
    const end = seen.find(([kind]) => kind === "end")?.[1] as
      | { size: number; velocity: number }
      | undefined;
    expect(typeof start?.size).toBe("number");
    expect(typeof end?.size).toBe("number");
    expect(typeof end?.velocity).toBe("number");
    unmount(instance);
  });

  it("passes the reason of close() on, and forwards the layout methods", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const reasons: string[] = [];
    const props = makeProps(
      baseProps({
        initial: "full",
        duration: 0,
        onbeforeclose: (payload: { reason: string }) =>
          reasons.push(payload.reason),
      }),
    );
    const instance = mount(Cmp, { target, props }) as unknown as {
      close: (reason?: string) => Promise<void>;
      recompute: () => void;
      addAnchor: (opts: { element: HTMLElement }) => () => void;
      setScrimStages: (opts: null) => () => void;
    };
    flushSync();
    await wait(40);
    expect(typeof instance.recompute).toBe("function");
    const detach = instance.addAnchor({
      element: document.createElement("div"),
    });
    expect(typeof detach).toBe("function");
    detach();
    expect(typeof instance.setScrimStages(null)).toBe("function");
    await instance.close("escape");
    expect(reasons).toEqual(["escape"]);
    unmount(instance);
  });

  it("writes the physical edge to data-mode for logical modes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = makeProps(baseProps({ initial: "full", mode: "start" }));
    const instance = mount(Cmp, { target, props });
    flushSync();
    await wait(40);
    const sheet = target.querySelector<HTMLElement>(".bs-sheet")!;
    expect(sheet.dataset.mode).toBe("left");

    props.mode = "right";
    flushSync();
    await wait(40);
    expect(sheet.dataset.mode).toBe("right");

    props.mode = "end";
    flushSync();
    await wait(40);
    expect(sheet.dataset.mode).toBe("right");
    unmount(instance);
  });

  it("renders a sheet that starts closed as resting closed on the server", async () => {
    const { js } = compile(readFileSync(sfcPath, "utf8"), {
      filename: "BottomSheet.svelte",
      generate: "server",
      dev: false,
    });
    writeFileSync(serverPath, js.code, "utf8");
    const Server = (await import(pathToFileURL(serverPath).href)).default;
    const { render } = (await import("svelte/server")) as {
      render: (
        component: unknown,
        options: { props: Record<string, unknown> },
      ) => { body: string };
    };
    const closed = render(Server, { props: baseProps({}) }).body;
    const opened = render(Server, { props: baseProps({ initial: "full" }) }).body;
    expect(closed).toContain('data-bs-rest="closed"');
    expect(opened).not.toContain("data-bs-rest");
  });
});
