import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentLift, webglRenderer } from "../../src/webgl";
import type { WebGLRendererOptions } from "../../src/webgl";
import type { EngineFeatureContext } from "../../src/core/types";

type Frame = {
  rect: number[];
  bend: number;
  axis: number;
  lead: number;
  content: number;
};

const VIEW = { left: 0, top: 0, width: 390, height: 800 };
const FRAME_MS = 16;
const BEND: WebGLRendererOptions = { jelly: 0.5 };

const boxOf = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const mount = (
  options: WebGLRendererOptions = {},
  mode: "bottom" | "left" = "bottom",
  given: WebGLRendererOptions = BEND,
) => {
  const frames: Frame[] = [];
  const uniforms: Record<string, number[]> = {};
  const counts = { textures: 0 };

  const gl = new Proxy(
    {
      RENDERER: 0x1f01,
      getExtension: (name: string) =>
        name === "WEBGL_lose_context" ? { loseContext: () => {} } : null,
      getParameter: (id: number) => (id === 0x1f01 ? "Apple GPU" : 4096),
      getShaderPrecisionFormat: () => ({ precision: 23 }),
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getUniformLocation: (_program: unknown, name: string) => ({ name }),
      uniform1f: (loc: { name: string }, a: number) => {
        uniforms[loc.name] = [a];
      },
      uniform2f: (loc: { name: string }, a: number, b: number) => {
        uniforms[loc.name] = [a, b];
      },
      uniform4f: (
        loc: { name: string },
        a: number,
        b: number,
        c: number,
        d: number,
      ) => {
        uniforms[loc.name] = [a, b, c, d];
      },
      texImage2D: () => {
        counts.textures += 1;
      },
      drawArrays: () => {
        frames.push({
          rect: uniforms.u_rect ?? [],
          bend: uniforms.u_bend?.[0] ?? 0,
          axis: uniforms.u_axis?.[0] ?? 0,
          lead: uniforms.u_lead?.[0] ?? 0,
          content: uniforms.u_hasContent?.[0] ?? 0,
        });
      },
    } as Record<string, unknown>,
    {
      get(source, key) {
        if (key in source) return source[key as string];
        if (typeof key === "string" && /^[A-Z0-9_]+$/.test(key)) return 1;
        return () => ({});
      },
    },
  );

  const pen = new Proxy(
    {
      measureText: () => ({
        width: 40,
        fontBoundingBoxAscent: 11,
        fontBoundingBoxDescent: 3,
      }),
      getImageData: () => ({ data: [255, 255, 255, 255] }),
    } as Record<string, unknown>,
    {
      get(source, key) {
        if (key in source) return source[key as string];
        return () => undefined;
      },
      set: () => true,
    },
  );

  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
    type: string,
  ) => (type.includes("webgl") ? gl : pen)) as never);

  const root = document.createElement("div");
  const sheet = document.createElement("section");
  sheet.dataset.mode = mode;
  sheet.style.background = "rgb(20, 20, 20)";
  const line = document.createElement("p");
  line.textContent = "A line of text";
  sheet.append(line);
  root.append(sheet);
  document.body.append(root);

  const transitions: Array<{ transitionProperty: string }> = [];
  (sheet as unknown as { getAnimations: () => unknown[] }).getAnimations = () =>
    transitions;

  const position = { along: mode === "bottom" ? 500 : 300 };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this === sheet) {
        return mode === "bottom"
          ? boxOf(0, position.along, 390, 600)
          : boxOf(position.along - 300, 0, 300, 800);
      }
      if (this instanceof HTMLCanvasElement) {
        return boxOf(VIEW.left, VIEW.top, VIEW.width, VIEW.height);
      }
      return boxOf(16, position.along + 40, 200, 20);
    },
  );

  Range.prototype.getClientRects = function () {
    return [boxOf(16, position.along + 44, 40, 14)] as unknown as DOMRectList;
  };

  const handlers: Record<string, Array<(payload: unknown) => void>> = {};
  const state = { dragging: false, animating: false };
  const ctx = {
    element: sheet,
    sheetId: "test",
    options: {},
    isDestroyed: () => false,
    isDragging: () => state.dragging,
    isAnimating: () => state.animating,
    isTopSheet: () => true,
    isVerticalAxis: () => mode === "bottom",
    getSize: () => 300,
    getMaxAxisSize: () => 600,
    on: (event: string, fn: (payload: unknown) => void) => {
      (handlers[event] ??= []).push(fn);
      return () => {};
    },
    addTeardown: () => {},
  } as unknown as EngineFeatureContext;

  const dispose = webglRenderer({ ...given, ...options }).install(ctx);

  const emit = (event: string, payload: unknown = {}): void => {
    for (const fn of handlers[event] ?? []) fn(payload);
  };
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };
  const moveTo = async (along: number): Promise<void> => {
    position.along = along;
    sheet.style.transform = `translate3d(0px, ${along}px, 0px)`;
    await settle();
  };
  const slideTo = (along: number): void => {
    position.along = along;
  };
  const frame = async (count = 1): Promise<void> => {
    for (let i = 0; i < count; i++) {
      vi.advanceTimersByTime(FRAME_MS);
      await settle();
    }
  };
  let stalled = 0;
  const clock = performance.now.bind(performance);
  vi.spyOn(performance, "now").mockImplementation(() => clock() + stalled);
  const stall = (ms: number): void => {
    stalled += ms;
  };

  return {
    sheet,
    line,
    frames,
    transitions,
    slideTo,
    counts,
    state,
    emit,
    moveTo,
    frame,
    stall,
    dispose: () => {
      if (typeof dispose === "function") dispose();
    },
  };
};

describe("the WebGL surface in motion", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const drag = async (
    r: ReturnType<typeof mount>,
    from: number,
    to: number,
    frames: number,
  ): Promise<void> => {
    r.state.dragging = true;
    r.emit("dragstart", { size: 300 });
    await r.frame();
    for (let i = 1; i <= frames; i++) {
      const along = from + ((to - from) * i) / frames;
      await r.moveTo(along);
      r.emit("drag", { size: 800 - along, delta: from - along });
      await r.frame();
    }
  };

  it("does not jerk when a resting finger moves by a pixel", async () => {
    const r = mount();
    await drag(r, 500, 300, 15);
    await r.frame(60);
    const before = r.frames.length;

    await r.moveTo(299);
    r.emit("drag", { size: 501, delta: 201 });
    await r.frame(12);

    const after = r.frames.slice(before).map(f => Math.abs(f.bend));
    expect(after.length).toBeGreaterThan(0);
    expect(Math.max(...after)).toBeLessThan(2);
    r.dispose();
  });

  it("bends while the sheet moves and is flat again soon after it stops", async () => {
    const r = mount();
    await drag(r, 500, 200, 12);
    const moving = Math.max(...r.frames.map(f => Math.abs(f.bend)));
    expect(moving).toBeGreaterThan(2);

    await r.frame(80);
    expect(Math.abs(r.frames[r.frames.length - 1]!.bend)).toBeLessThan(0.3);
    r.dispose();
  });

  it("draws the new position in the same task as the write that moved the sheet", async () => {
    const r = mount();
    r.state.dragging = true;
    r.emit("dragstart", { size: 300 });
    await r.frame(2);

    await r.moveTo(420);

    expect(r.frames[r.frames.length - 1]!.rect[1]).toBe(420);
    r.dispose();
  });

  const animate = async (
    r: ReturnType<typeof mount>,
    from: number,
    step: number,
    frames: number,
  ): Promise<void> => {
    r.state.animating = true;
    r.emit("progress");
    await r.frame();
    for (let i = 1; i <= frames; i++) {
      await r.moveTo(from + step * i);
      await r.frame();
    }
  };

  it("does not snap flat on the last frame of an animation", async () => {
    const r = mount();
    await animate(r, 500, -14, 15);
    const moving = Math.abs(r.frames[r.frames.length - 1]!.bend);

    r.state.animating = false;
    await r.moveTo(500 - 14 * 16);
    await r.frame();
    const justAfter = Math.abs(r.frames[r.frames.length - 1]!.bend);

    expect(moving).toBeGreaterThan(2);
    expect(justAfter).toBeGreaterThan(moving * 0.5);
    r.dispose();
  });

  it("does not leave the surface bent when the page stalls through the end of an animation", async () => {
    const r = mount();
    await animate(r, 500, -14, 15);
    expect(Math.abs(r.frames[r.frames.length - 1]!.bend)).toBeGreaterThan(2);

    r.stall(2500);
    r.state.animating = false;
    await r.moveTo(500 - 14 * 16);
    await r.frame(4);

    expect(r.frames[r.frames.length - 1]!.bend).toBe(0);
    r.dispose();
  });

  it("draws once a frame while the sheet moves", async () => {
    const r = mount();
    r.state.animating = true;
    r.emit("progress");
    await r.frame(2);
    const before = r.frames.length;

    for (let i = 1; i <= 20; i++) {
      await r.moveTo(500 - i * 10);
      await r.frame();
    }

    expect(r.frames.length - before).toBeLessThanOrEqual(21);
    r.dispose();
  });

  it("does not bend when the sheet is put somewhere else in one step", async () => {
    const r = mount();
    await r.moveTo(120);
    await r.frame(6);

    expect(Math.max(...r.frames.map(f => Math.abs(f.bend)))).toBe(0);
    r.dispose();
  });

  it("goes quiet once nothing moves", async () => {
    const r = mount();
    await drag(r, 500, 300, 10);
    r.state.dragging = false;
    r.emit("dragend", { size: 500, velocity: 0 });
    await r.frame(120);
    const settled = r.frames.length;

    await r.frame(60);

    expect(r.frames.length).toBe(settled);
    r.dispose();
  });

  it("bends a side sheet along its own axis", async () => {
    const r = mount({}, "left");
    r.state.dragging = true;
    r.emit("dragstart", { size: 300 });
    await r.frame();
    for (let i = 1; i <= 12; i++) {
      await r.moveTo(300 - i * 15);
      await r.frame();
    }

    const last = r.frames[r.frames.length - 1]!;
    expect(last.axis).toBe(1);
    expect(Math.max(...r.frames.map(f => Math.abs(f.bend)))).toBeGreaterThan(2);
    r.dispose();
  });

  it("stays flat unless a bend is asked for", async () => {
    const r = mount({}, "bottom", {});
    await drag(r, 500, 200, 12);

    expect(r.frames.length).toBeGreaterThan(5);
    expect(Math.max(...r.frames.map(f => Math.abs(f.bend)))).toBe(0);
    r.dispose();
  });

  it("says so when a lift is given and there is no bend for it to follow", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = mount({ lift: contentLift() }, "bottom", {});
    await drag(r, 500, 400, 6);

    expect(r.counts.textures).toBe(0);
    expect(r.line.style.color).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("jelly");
    r.dispose();
  });

  it("keeps quiet about a lift that has a bend to follow", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = mount({ lift: contentLift() });
    await drag(r, 500, 400, 6);

    expect(warn).not.toHaveBeenCalled();
    r.dispose();
  });

  it("tells the shader that the top of a bottom sheet leads", async () => {
    const r = mount();
    await drag(r, 500, 300, 6);

    expect(r.frames[r.frames.length - 1]!.lead).toBe(1);
    r.dispose();
  });

  it("tells the shader that the far side of a left sheet leads", async () => {
    const r = mount({}, "left");
    r.state.dragging = true;
    r.emit("dragstart", { size: 300 });
    await r.frame();
    for (let i = 1; i <= 6; i++) {
      await r.moveTo(300 - i * 15);
      await r.frame();
    }

    expect(r.frames[r.frames.length - 1]!.lead).toBe(-1);
    r.dispose();
  });

  it("follows a sheet that a transition is moving, flat, and stops when it ends", async () => {
    const r = mount();
    await r.frame(3);
    const before = r.frames.length;

    r.transitions.push({ transitionProperty: "bottom" });
    r.sheet.dispatchEvent(new Event("transitionrun"));
    for (let i = 1; i <= 10; i++) {
      r.slideTo(500 - i * 30);
      await r.frame();
    }

    const drawn = r.frames.slice(before);
    expect(drawn.length).toBeGreaterThanOrEqual(10);
    expect(drawn[drawn.length - 1]!.rect[1]).toBe(200);
    expect(Math.max(...drawn.map(f => Math.abs(f.bend)))).toBe(0);

    r.transitions.length = 0;
    await r.frame(4);
    const settled = r.frames.length;
    await r.frame(30);

    expect(r.frames.length).toBe(settled);
    r.dispose();
  });

  it("lands with the sheet when a transition is over before the next frame comes", async () => {
    const r = mount();
    await r.frame(3);

    await r.moveTo(500);
    r.slideTo(350);
    await r.frame(4);

    expect(r.frames[r.frames.length - 1]!.rect[1]).toBe(350);
    r.dispose();
  });

  it("is not woken by a transition of something inside the sheet", async () => {
    const r = mount();
    await r.frame(3);
    const before = r.frames.length;

    r.line.dispatchEvent(new Event("transitionrun", { bubbles: true }));
    await r.frame(6);

    expect(r.frames.length).toBe(before);
    r.dispose();
  });

  it("leaves the content in the DOM unless it is told to lift it", async () => {
    const r = mount();
    await drag(r, 500, 400, 6);

    expect(r.counts.textures).toBe(0);
    expect(r.line.style.color).toBe("");
    r.dispose();
  });

  it("does not lift on the retired boolean flag alone", async () => {
    const r = mount({ liftContent: true });
    await drag(r, 500, 400, 6);

    expect(r.counts.textures).toBe(0);
    expect(r.line.style.color).toBe("");
    r.dispose();
  });

  it("lifts the content into a texture when asked", async () => {
    const r = mount({ lift: contentLift() });
    await drag(r, 500, 400, 6);

    expect(r.counts.textures).toBeGreaterThan(0);
    expect(r.line.style.color).toBe("transparent");
    expect(r.frames[r.frames.length - 1]!.content).toBe(1);
    r.dispose();
  });

  it("keeps the content in the DOM until the sheet actually moves", async () => {
    const r = mount({ lift: contentLift() });
    r.state.dragging = true;
    r.emit("dragstart", { size: 300 });
    await r.frame(3);

    expect(r.counts.textures).toBeGreaterThan(0);
    expect(r.line.style.color).toBe("");
    expect(r.frames.every(f => f.content === 0)).toBe(true);

    await r.moveTo(497);
    r.emit("drag", { size: 303, delta: 3 });
    await r.frame();

    expect(r.line.style.color).toBe("transparent");
    expect(r.frames[r.frames.length - 1]!.content).toBe(1);
    r.dispose();
  });

  it("leaves the DOM alone through a press that never moves", async () => {
    const r = mount({ lift: contentLift() });
    r.state.dragging = true;
    r.emit("dragstart", { size: 300 });
    await r.frame(3);
    r.state.dragging = false;
    r.emit("dragend", { size: 300, velocity: 0 });
    await r.frame(10);

    expect(r.line.style.color).toBe("");
    expect(r.frames.every(f => f.content === 0)).toBe(true);
    r.dispose();
  });

  it("does not lift anything when there is no bend to show", async () => {
    const r = mount({ lift: contentLift(), jelly: 0 });
    await drag(r, 500, 400, 6);

    expect(r.counts.textures).toBe(0);
    expect(r.line.style.color).toBe("");
    r.dispose();
  });

  it("hands the content back under the same compositor hint it was lifted under", async () => {
    const r = mount({ lift: contentLift() });
    r.sheet.style.willChange = "transform";
    await drag(r, 500, 400, 6);
    await r.frame(60);
    r.state.dragging = false;
    r.sheet.style.willChange = "";
    r.emit("dragend", { size: 400, velocity: 0 });

    let hintAtHandBack = "unset";
    for (let i = 0; i < 20 && hintAtHandBack === "unset"; i++) {
      await r.frame();
      if (r.line.style.color === "") hintAtHandBack = r.sheet.style.willChange;
    }
    await r.frame(3);

    expect(hintAtHandBack).toBe("transform");
    expect(r.sheet.style.willChange).toBe("");
    r.dispose();
  });

  it("leaves the hint to the engine when a new animation starts right after the hand-back", async () => {
    const r = mount({ lift: contentLift() });
    r.sheet.style.willChange = "transform";
    await drag(r, 500, 400, 6);
    await r.frame(60);
    r.state.dragging = false;
    r.sheet.style.willChange = "";
    r.emit("dragend", { size: 400, velocity: 0 });
    for (let i = 0; i < 20 && r.line.style.color !== ""; i++) await r.frame();

    r.state.animating = true;
    r.sheet.style.willChange = "transform";
    await r.frame(3);

    expect(r.sheet.style.willChange).toBe("transform");
    r.dispose();
  });

  it("stays lifted when the content changes in the middle of a drag", async () => {
    const r = mount({ lift: contentLift() });
    await drag(r, 500, 400, 6);
    const before = r.counts.textures;

    const added = document.createElement("p");
    added.textContent = "A late line";
    r.sheet.append(added);
    await r.frame();

    expect(r.counts.textures).toBeGreaterThan(before);
    expect(r.line.style.color).toBe("transparent");
    expect(added.style.color).toBe("transparent");
    r.dispose();
  });

  it("gives the content back to the DOM once the sheet is let go", async () => {
    const r = mount({ lift: contentLift() });
    await drag(r, 500, 400, 6);
    r.state.dragging = false;
    r.emit("dragend", { size: 400, velocity: 0 });
    await r.frame(40);

    expect(r.line.style.color).toBe("");
    expect(r.frames[r.frames.length - 1]!.content).toBe(0);
    r.dispose();
  });
});
