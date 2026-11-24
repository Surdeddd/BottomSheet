import { beforeEach, describe, expect, it } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import type { EngineOptions } from "../../src/core/types";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { makeDom } from "./_helpers/makeDom";

const SNAPS = [
  { id: "closed", size: 0 },
  { id: "peek", size: 120 },
  { id: "half", size: 400 },
  { id: "full", size: 700 },
];

const mount = (options: Partial<EngineOptions> = {}): BottomSheetEngine => {
  const { sheet, handle, content } = makeDom();
  return new BottomSheetEngine({
    element: sheet,
    handle,
    scrollContainer: content,
    snapPoints: SNAPS,
    initial: "peek",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
    ...options,
  });
};

describe("what a move's promise says", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("says landed when the sheet reaches the snap", async () => {
    const engine = mount();

    expect(await engine.snapTo("half")).toBe("landed");
    expect(await engine.expand()).toBe("landed");
    expect(await engine.collapse()).toBe("landed");
    expect(await engine.close()).toBe("landed");
    expect(await engine.open()).toBe("landed");
    engine.destroy();
  });

  it("says landed when the sheet is already where it was asked to go", async () => {
    const engine = mount();

    expect(await engine.snapTo("peek")).toBe("landed");
    expect(await engine.open()).toBe("landed");
    await engine.close();
    expect(await engine.close()).toBe("landed");
    engine.destroy();
  });

  it("says vetoed when a before-snap listener refuses the move", async () => {
    const engine = mount();
    engine.on("before-snap", payload => {
      if (payload.id === "full") payload.cancel();
    });

    expect(await engine.snapTo("full")).toBe("vetoed");
    expect(await engine.snapTo("half")).toBe("landed");
    engine.destroy();
  });

  it("says vetoed when a before-close listener keeps the sheet open", async () => {
    const engine = mount();
    engine.on("before-close", payload => payload.cancel());

    expect(await engine.close()).toBe("vetoed");
    expect(engine.state.activeId).toBe("peek");
    engine.destroy();
  });

  it("says vetoed for a snap that does not exist or is not allowed", async () => {
    const engine = mount({ allowed: ["closed", "peek", "half"] });

    expect(await engine.snapTo("nowhere")).toBe("vetoed");
    expect(await engine.snapTo("full")).toBe("vetoed");
    engine.destroy();
  });

  it("says vetoed when closing is switched off", async () => {
    const locked = mount({ disableClose: true });
    expect(await locked.close()).toBe("vetoed");
    expect(await locked.snapTo("closed")).toBe("vetoed");
    locked.destroy();

    const persistent = mount({ persistent: true });
    expect(await persistent.close("backdrop")).toBe("vetoed");
    expect(await persistent.close()).toBe("landed");
    persistent.destroy();
  });

  it("says vetoed when the signal was aborted before the move began", async () => {
    const engine = mount();
    const control = new AbortController();
    control.abort();

    expect(await engine.snapTo("half", { signal: control.signal })).toBe(
      "vetoed",
    );
    engine.destroy();
  });

  it("says replaced to the move another one overtook, and landed to the one that got there", async () => {
    const engine = mount({ duration: 60 });

    const first = engine.snapTo("full");
    await Promise.resolve();
    const second = engine.snapTo("half");

    expect(await first).toBe("replaced");
    expect(await second).toBe("landed");
    expect(engine.state.activeId).toBe("half");
    engine.destroy();
  });

  it("says replaced when the move's own signal is aborted on the way", async () => {
    const engine = mount({ duration: 60 });
    const control = new AbortController();

    const move = engine.snapTo("full", { signal: control.signal });
    await Promise.resolve();
    control.abort();

    expect(await move).toBe("replaced");
    engine.destroy();
  });

  it("gives one answer to two calls for the same snap in one flight", async () => {
    const engine = mount({ duration: 60 });

    const first = engine.snapTo("full");
    const second = engine.snapTo("full");

    expect(await Promise.all([first, second])).toEqual(["landed", "landed"]);
    engine.destroy();
  });

  it("lets open() on an opening sheet wait for that opening", async () => {
    const engine = mount({ initial: "closed", duration: 60 });

    const opening = engine.open();
    await Promise.resolve();
    const again = engine.open();
    let settled = false;
    void again.then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(await Promise.all([opening, again])).toEqual(["landed", "landed"]);
    engine.destroy();
  });

  it("says landed when a move is finished early in place", async () => {
    const engine = mount({ duration: 60 });

    const move = engine.snapTo("full");
    await Promise.resolve();
    engine.setMode("top");

    expect(await move).toBe("landed");
    expect(engine.state.activeId).toBe("full");
    engine.destroy();
  });

  it("says replaced when the engine is destroyed on the way, and vetoed afterwards", async () => {
    const engine = mount({ duration: 60 });

    const move = engine.snapTo("full");
    await Promise.resolve();
    engine.destroy();

    expect(await move).toBe("replaced");
    expect(await engine.snapTo("half")).toBe("vetoed");
    expect(await engine.open()).toBe("vetoed");
    expect(await engine.close()).toBe("vetoed");
    engine.destroy();
  });
});
