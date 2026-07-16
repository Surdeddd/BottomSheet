import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { compile } from "svelte/compiler";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

const here = dirname(fileURLToPath(import.meta.url));
const sfcPath = resolve(here, "../../src/svelte/BottomSheet.svelte");
const tmpPath = resolve(here, "../../src/svelte/__open-at-mount.gen.js");
const clientPath = resolve(
  here,
  "../../node_modules/svelte/src/index-client.js",
);

type SheetInstance = { getEngine: () => { state: { size: number } } | null };
type MountFn = (
  component: unknown,
  options: { target: HTMLElement; props: Record<string, unknown> },
) => SheetInstance;

let Cmp: unknown;
let mount: MountFn;
let unmount: (instance: unknown) => void;
let flushSync: () => void;

beforeAll(async () => {
  rmSync(tmpPath, { force: true });
  const client = (await import(pathToFileURL(clientPath).href)) as {
    mount: MountFn;
    unmount: typeof unmount;
    flushSync: typeof flushSync;
  };
  mount = client.mount;
  unmount = client.unmount;
  flushSync = client.flushSync;

  const { js } = compile(readFileSync(sfcPath, "utf8"), {
    filename: "BottomSheet.svelte",
    generate: "client",
    dev: false,
  });
  const patched = js.code.replace(
    /from\s*["']svelte["']/g,
    `from ${JSON.stringify(clientPath)}`,
  );
  writeFileSync(tmpPath, patched, "utf8");
  Cmp = (await import(pathToFileURL(tmpPath).href)).default;
});

afterAll(() => {
  rmSync(tmpPath, { force: true });
});

const settle = (): Promise<void> => new Promise(r => setTimeout(r, 60));

const baseProps = (extra: Record<string, unknown>): Record<string, unknown> => ({
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "full", size: 400 },
  ],
  initial: "closed",
  teleport: false,
  animation: "tween",
  duration: 0,
  respectReducedMotion: false,
  ...extra,
});

describe("Svelte <BottomSheet> open at mount", () => {
  beforeAll(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
  });

  it("open=true at mount opens the sheet", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const inst = mount(Cmp, { target, props: baseProps({ open: true }) });
    flushSync();
    await settle();
    flushSync();

    expect(inst.getEngine()?.state.size ?? 0).toBeGreaterThan(0);

    unmount(inst);
    target.remove();
  });

  it("open stays false at mount when not requested", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const inst = mount(Cmp, { target, props: baseProps({}) });
    flushSync();
    await settle();
    flushSync();

    expect(inst.getEngine()?.state.size ?? -1).toBe(0);

    unmount(inst);
    target.remove();
  });
});
