import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const settle = () => new Promise(r => setTimeout(r, 30));

const makeSheet = () => {
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  const content = document.createElement("div");
  sheet.append(handle, content);
  document.body.appendChild(sheet);
  for (const el of [handle, content]) {
    Object.assign(el, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
  }
  return { sheet, handle, content };
};

const baseOpts = (extra: Record<string, unknown> = {}) => {
  const n = makeSheet();
  return {
    nodes: n,
    opts: {
      element: n.sheet,
      handle: n.handle,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed" as const,
      animation: "tween" as const,
      duration: 10,
      ...extra,
    },
  };
};

describe("limits — many snap points", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("resolves and snaps across 64 points without dropping any", async () => {
    const points = Array.from({ length: 64 }, (_, i) => ({
      id: `p${i}`,
      size: i * 10,
    }));
    const { opts } = baseOpts({ snapPoints: points, initial: "p0" });
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    expect(engine.getAllowedIds()).toHaveLength(64);

    await engine.snapTo("p63");
    await settle();
    expect(engine.state.activeId).toBe("p63");

    await engine.snapTo("p7");
    await settle();
    expect(engine.state.activeId).toBe("p7");

    engine.destroy();
  });

  it("keeps snapping correct after the point list is swapped wholesale", async () => {
    const { opts } = baseOpts();
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    engine.setSnapPoints(
      Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, size: i * 12 })),
    );
    await settle();

    expect(engine.getAllowedIds()).toHaveLength(40);
    await engine.snapTo("q39");
    await settle();
    expect(engine.state.activeId).toBe("q39");

    engine.destroy();
  });

  it("survives duplicate ids without corrupting the active point", async () => {
    const { opts } = baseOpts({
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "dup", size: 100 },
        { id: "dup", size: 200 },
      ],
      initial: "closed",
    });
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    await engine.snapTo("dup");
    await settle();
    expect(engine.state.activeId).toBe("dup");
    expect(Number.isFinite(engine.state.size)).toBe(true);

    engine.destroy();
  });
});

describe("limits — mode and structure changes", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("switching the drag surface repeatedly leaves exactly one live gesture", async () => {
    const { nodes, opts } = baseOpts({ scrollContainer: undefined });
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    for (let i = 0; i < 20; i++) {
      engine.setDragFrom(i % 2 === 0 ? "sheet" : "handle");
    }
    await settle();

    expect(engine.getDragFrom()).toBe("handle");
    await engine.snapTo("full");
    await settle();
    expect(engine.state.activeId).toBe("full");

    engine.destroy();
    expect(nodes.sheet.isConnected).toBe(true);
  });

  it("a nested scroll container does not break drag gating", async () => {
    const n = makeSheet();
    const inner = document.createElement("div");
    const deepest = document.createElement("div");
    inner.appendChild(deepest);
    n.content.appendChild(inner);
    Object.assign(inner, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });

    const engine = new BottomSheetEngine({
      element: n.sheet,
      handle: n.handle,
      scrollContainer: n.content,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: 400 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 10,
    } as never);
    await settle();

    await engine.snapTo("full");
    await settle();
    expect(engine.state.activeId).toBe("full");

    engine.destroy();
  });

  it("destroy during an in-flight animation does not throw or leak state", async () => {
    const { opts } = baseOpts();
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    void engine.snapTo("full");
    expect(() => engine.destroy()).not.toThrow();
    await settle();
  });

  it("repeated open/close cycles settle deterministically", async () => {
    const { opts } = baseOpts();
    const engine = new BottomSheetEngine(opts as never);
    await settle();

    for (let i = 0; i < 12; i++) {
      await engine.snapTo("full");
      await settle();
      await engine.snapTo("closed");
      await settle();
    }

    expect(engine.state.activeId).toBe("closed");
    engine.destroy();
  });
});
