import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { resolveSheetAnchoredStyle } from "../../src/core/primitives/overlay-position";
import { makeDom } from "./_helpers/makeDom";

class FakeVisualViewport extends EventTarget {
  height = 1000;
  width = 400;
  offsetTop = 0;
  scale = 1;
}

const frame = (): Promise<void> => new Promise(r => setTimeout(r, 40));

const build = () => {
  const dom = makeDom();
  const root = document.createElement("div");
  root.className = "bs-root";
  document.body.append(root);
  root.append(dom.backdrop, dom.sheet);
  const engine = new BottomSheetEngine({
    element: dom.sheet,
    handle: dom.handle,
    backdrop: dom.backdrop,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: 300 },
      { id: "full", size: 800 },
    ],
    initial: "half",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
  });
  const inset = (): string => dom.sheet.style.getPropertyValue("--bs-keyboard-inset");
  const rootInset = (): string => root.style.getPropertyValue("--bs-keyboard-inset");
  return { dom, root, engine, inset, rootInset };
};

describe("the on-screen keyboard", () => {
  let vv: FakeVisualViewport;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
    vv = new FakeVisualViewport();
    Object.defineProperty(window, "visualViewport", {
      value: vv,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      value: undefined,
      configurable: true,
    });
  });

  const move = async (
    next: Partial<FakeVisualViewport>,
    event = "resize",
  ): Promise<void> => {
    Object.assign(vv, next);
    vv.dispatchEvent(new Event(event));
    await frame();
  };

  it("publishes how much of the screen the keyboard covers", async () => {
    const { engine, inset, rootInset } = build();
    await move({ height: 600 });
    expect(inset()).toBe("400px");
    expect(rootInset()).toBe("400px");
    engine.destroy();
  });

  it("counts a panned viewport as less covered", async () => {
    const { engine, inset } = build();
    await move({ height: 600 });
    await move({ offsetTop: 150 }, "scroll");
    expect(inset()).toBe("250px");
    engine.destroy();
  });

  it("goes back to zero when the keyboard closes", async () => {
    const { engine, inset } = build();
    await move({ height: 600 });
    await move({ height: 1000 });
    expect(inset()).toBe("0px");
    engine.destroy();
  });

  it("ignores a pinch zoom", async () => {
    const { engine, inset } = build();
    await move({ height: 500, scale: 2 });
    expect(inset()).toBe("");
    engine.destroy();
  });

  it("ignores a sliver that is not a keyboard", async () => {
    const { engine, inset } = build();
    await move({ height: 985 });
    expect(inset()).toBe("");
    engine.destroy();
  });

  it("removes the value when the sheet is destroyed", async () => {
    const { engine, inset, rootInset } = build();
    await move({ height: 600 });
    engine.destroy();
    expect(inset()).toBe("");
    expect(rootInset()).toBe("");
  });

  describe("the room above an open keyboard", () => {
    const raised = async () => {
      const built = build();
      await built.engine.snapTo("full");
      await move({ height: 600 });
      return built;
    };

    it("holds the sheet to what the keyboard leaves visible", async () => {
      const { dom, engine } = await raised();
      expect(engine.state.size).toBe(592);
      expect(dom.sheet.style.height).toBe("592px");
      engine.destroy();
    });

    it.each<[string, (engine: BottomSheetEngine) => void]>([
      [
        "the window reports a resize",
        () => window.dispatchEvent(new Event("orientationchange")),
      ],
      ["the snap points are measured again", engine => engine.recompute()],
      [
        "the snap points are replaced",
        engine =>
          engine.setSnapPoints([
            { id: "closed", size: 0 },
            { id: "half", size: 300 },
            { id: "full", size: 900 },
          ]),
      ],
    ])("still holds it after %s", async (_, act) => {
      const { dom, engine } = await raised();

      act(engine);

      expect(engine.state.size).toBe(592);
      expect(dom.sheet.style.height).toBe("592px");
      engine.destroy();
    });

    it("gives the room back once the keyboard is closed", async () => {
      const { dom, engine } = await raised();
      await move({ height: 1000 });

      engine.recompute();

      expect(engine.state.size).toBe(800);
      expect(dom.sheet.style.height).toBe("800px");
      engine.destroy();
    });

    it("does not carry the room of one axis over to the other", async () => {
      const { dom, engine } = await raised();

      engine.setMode("right");

      expect(dom.sheet.style.width).toBe("800px");
      engine.destroy();
    });
  });

  it("keeps anchors on the edge of a lifted bottom sheet only", () => {
    expect(
      resolveSheetAnchoredStyle("bottom", "sheet-top-right", "16px").bottom,
    ).toBe("calc(var(--bs-size, 0px) + var(--bs-keyboard-inset, 0px) + 16px)");
    expect(resolveSheetAnchoredStyle("top", "sheet-top-right", "16px").top).toBe(
      "calc(var(--bs-size, 0px) + 16px)",
    );
  });
});
