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
