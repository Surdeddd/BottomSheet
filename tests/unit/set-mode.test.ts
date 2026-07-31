import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const settle = () => new Promise(r => setTimeout(r, 40));

const mount = (dir?: "ltr" | "rtl") => {
  const host = document.createElement("div");
  if (dir) host.setAttribute("dir", dir);
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  sheet.appendChild(handle);
  host.appendChild(sheet);
  document.body.appendChild(host);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { host, sheet, handle };
};

const build = (nodes: ReturnType<typeof mount>, mode: string) =>
  new BottomSheetEngine({
    element: nodes.sheet,
    handle: nodes.handle,
    mode,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: 200 },
      { id: "open", size: 400 },
    ],
    initial: "half",
    animation: "tween",
    duration: 10,
  } as never);

describe("setMode", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("moves the sheet to another physical edge", async () => {
    const n = mount();
    const engine = build(n, "bottom");
    await settle();
    expect(engine.getMode()).toBe("bottom");

    engine.setMode("right");
    await settle();

    expect(engine.getMode()).toBe("right");
    expect(n.sheet.dataset.mode).toBe("right");
    engine.destroy();
  });

  it("keeps the active snap point across the change", async () => {
    const n = mount();
    const engine = build(n, "bottom");
    await settle();
    await engine.snapTo("open");
    await settle();

    engine.setMode("left");
    await settle();

    expect(engine.state.activeId).toBe("open");
    expect(engine.state.size).toBeGreaterThan(0);
    engine.destroy();
  });

  it("is a no-op when the mode already matches", async () => {
    const n = mount();
    const engine = build(n, "bottom");
    await settle();
    const before = engine.state.size;

    engine.setMode("bottom");
    await settle();

    expect(engine.state.size).toBe(before);
    expect(engine.getMode()).toBe("bottom");
    engine.destroy();
  });

  it("resolves a logical mode against the current direction", async () => {
    const n = mount("rtl");
    const engine = build(n, "bottom");
    await settle();

    engine.setMode("start");
    await settle();

    expect(engine.getMode()).toBe("right");
    expect(n.sheet.dataset.mode).toBe("right");
    engine.destroy();
  });

  it("follows a direction flip when the logical mode is re-applied", async () => {
    const n = mount("ltr");
    const engine = build(n, "start");
    await settle();
    expect(engine.getMode()).toBe("left");

    n.host.setAttribute("dir", "rtl");
    engine.setMode("start");
    await settle();

    expect(engine.getMode()).toBe("right");
    engine.destroy();
  });

  it("still snaps after switching axis", async () => {
    const n = mount();
    const engine = build(n, "bottom");
    await settle();

    engine.setMode("left");
    await settle();

    await engine.snapTo("open");
    await settle();
    expect(engine.state.activeId).toBe("open");

    await engine.snapTo("closed");
    await settle();
    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });

  it("does nothing once destroyed", async () => {
    const n = mount();
    const engine = build(n, "bottom");
    await settle();
    engine.destroy();

    expect(() => engine.setMode("left")).not.toThrow();
    expect(engine.getMode()).toBe("bottom");
  });

  it("survives repeated switching without leaking drag state", async () => {
    const n = mount();
    const engine = build(n, "bottom");
    await settle();

    for (const m of ["left", "right", "top", "bottom", "left"] as const) {
      engine.setMode(m);
      await settle();
    }

    expect(engine.getMode()).toBe("left");
    expect(engine.state.isDragging).toBe(false);
    await engine.snapTo("open");
    await settle();
    expect(engine.state.activeId).toBe("open");
    engine.destroy();
  });
});
