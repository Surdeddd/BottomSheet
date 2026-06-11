import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { makeDom } from "./_helpers/makeDom";

const settle = () => new Promise(r => setTimeout(r, 30));

const SNAPS = [
  { id: "closed", size: 0 },
  { id: "peek", size: 120 },
  { id: "full", size: 800 },
];

const makeEngine = (initial = "peek") => {
  const { sheet, handle } = makeDom();
  const engine = new BottomSheetEngine({
    element: sheet,
    handle,
    snapPoints: SNAPS,
    initial,
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
  });
  return { engine, sheet };
};

describe("engine.addAnchor", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("mounts a fixed wrapper and shows the element while the sheet is open", () => {
    const { engine } = makeEngine("peek");
    const btn = document.createElement("button");
    engine.addAnchor({ element: btn });
    const wrapper = btn.parentElement!;
    expect(wrapper.className).toBe("bs-anchor");
    expect(wrapper.style.position).toBe("fixed");
    expect(wrapper.style.visibility).not.toBe("hidden");
    expect(wrapper.style.pointerEvents).toBe("auto");
    engine.destroy();
  });

  it("starts hidden when the sheet is closed and appears on open", async () => {
    const { engine } = makeEngine("closed");
    const btn = document.createElement("button");
    engine.addAnchor({ element: btn });
    const wrapper = btn.parentElement!;
    expect(wrapper.style.visibility).toBe("hidden");
    await engine.open("full");
    await settle();
    expect(wrapper.style.visibility).not.toBe("hidden");
    engine.destroy();
  });

  it("honors showOn snap-id list", async () => {
    const { engine } = makeEngine("peek");
    const btn = document.createElement("button");
    engine.addAnchor({ element: btn, showOn: ["full"], animation: "none" });
    const wrapper = btn.parentElement!;
    expect(wrapper.style.visibility).toBe("hidden");
    await engine.snapTo("full");
    await settle();
    expect(wrapper.style.visibility).not.toBe("hidden");
    await engine.snapTo("peek");
    await settle();
    expect(wrapper.style.visibility).toBe("hidden");
    engine.destroy();
  });

  it("honors a showOn predicate", async () => {
    const { engine } = makeEngine("peek");
    const btn = document.createElement("button");
    engine.addAnchor({
      element: btn,
      showOn: state => state.size > 500,
      animation: "none",
    });
    const wrapper = btn.parentElement!;
    expect(wrapper.style.visibility).toBe("hidden");
    await engine.snapTo("full");
    await settle();
    expect(wrapper.style.visibility).not.toBe("hidden");
    engine.destroy();
  });

  it("applies sheet-anchored position and fadeRange opacity binding", () => {
    const { engine } = makeEngine("peek");
    const btn = document.createElement("button");
    engine.addAnchor({
      element: btn,
      position: "sheet-top-right",
      inset: "20px",
      fadeRange: [0.5, 1],
    });
    const wrapper = btn.parentElement!;
    expect(wrapper.style.right).toBe("20px");
    expect(wrapper.style.opacity).toContain("--bs-progress");
    engine.destroy();
  });

  it("interactive: false keeps pointer-events none even when visible", () => {
    const { engine } = makeEngine("peek");
    const btn = document.createElement("button");
    engine.addAnchor({ element: btn, interactive: false });
    expect(btn.parentElement!.style.pointerEvents).toBe("none");
    engine.destroy();
  });

  it("writes --bs-size and --bs-progress to the anchor host", async () => {
    const { engine, sheet } = makeEngine("peek");
    const btn = document.createElement("button");
    engine.addAnchor({ element: btn });
    await engine.snapTo("full");
    await settle();
    const host = sheet.parentElement ?? document.body;
    expect(host.style.getPropertyValue("--bs-size")).toBe("800px");
    expect(host.style.getPropertyValue("--bs-progress")).toBe("1");
    engine.destroy();
  });

  it("detach removes the wrapper; destroy removes remaining anchors", () => {
    const { engine } = makeEngine("peek");
    const a = document.createElement("button");
    const b = document.createElement("button");
    const detachA = engine.addAnchor({ element: a });
    engine.addAnchor({ element: b });
    const wrapperA = a.parentElement!;
    const wrapperB = b.parentElement!;
    detachA();
    expect(wrapperA.isConnected).toBe(false);
    expect(wrapperB.isConnected).toBe(true);
    engine.destroy();
    expect(wrapperB.isConnected).toBe(false);
  });

  it("dock-bottom spans full width and stays visible even while closed", async () => {
    const { engine } = makeEngine("closed");
    const bar = document.createElement("nav");
    engine.addAnchor({ element: bar, position: "dock-bottom" });
    const wrapper = bar.parentElement!;
    expect(wrapper.style.left).toBe("0px");
    expect(wrapper.style.right).toBe("0px");
    expect(wrapper.style.bottom).toBe("0px");
    expect(wrapper.style.visibility).not.toBe("hidden");
    await engine.open("full");
    await settle();
    expect(wrapper.style.visibility).not.toBe("hidden");
    await engine.close();
    await settle();
    expect(wrapper.style.visibility).not.toBe("hidden");
    engine.destroy();
  });

  it("dock visibility can still be limited via showOn", async () => {
    const { engine } = makeEngine("peek");
    const bar = document.createElement("nav");
    engine.addAnchor({
      element: bar,
      position: "dock-bottom",
      showOn: ["full"],
      animation: "none",
    });
    const wrapper = bar.parentElement!;
    expect(wrapper.style.visibility).toBe("hidden");
    await engine.snapTo("full");
    await settle();
    expect(wrapper.style.visibility).not.toBe("hidden");
    engine.destroy();
  });

  it("stacks anchors above the sheet z-index", () => {
    const { engine, sheet } = makeEngine("peek");
    const btn = document.createElement("button");
    engine.addAnchor({ element: btn });
    const sheetZ = parseInt(sheet.style.zIndex, 10);
    const anchorZ = parseInt(btn.parentElement!.style.zIndex, 10);
    expect(anchorZ).toBe(sheetZ + 1);
    engine.destroy();
  });
});

describe("engine.setScrimStages", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  const makeWithScreen = (initial = "peek") => {
    const { sheet, handle } = makeDom();
    const screen = document.createElement("div");
    document.body.appendChild(screen);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      scrim: screen,
      snapPoints: SNAPS,
      initial,
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    return { engine, screen };
  };

  it("shows the stage matching the active snap id and swaps on snap", async () => {
    const { engine } = makeWithScreen("peek");
    const teaser = document.createElement("img");
    const promo = document.createElement("div");
    engine.setScrimStages({
      stages: [
        { for: "peek", element: teaser, animation: "none" },
        { for: "full", element: promo, animation: "none" },
      ],
    });
    expect(teaser.parentElement!.style.visibility).not.toBe("hidden");
    expect(promo.parentElement!.style.visibility).toBe("hidden");
    await engine.snapTo("full");
    await settle();
    expect(teaser.parentElement!.style.visibility).toBe("hidden");
    expect(promo.parentElement!.style.visibility).not.toBe("hidden");
    engine.destroy();
  });

  it("supports forRange progress binding", async () => {
    const { engine } = makeWithScreen("peek");
    const low = document.createElement("div");
    engine.setScrimStages({
      stages: [{ forRange: [0, 0.5], element: low, animation: "none" }],
    });
    expect(low.parentElement!.style.visibility).not.toBe("hidden");
    await engine.snapTo("full");
    await settle();
    expect(low.parentElement!.style.visibility).toBe("hidden");
    engine.destroy();
  });

  it("hides all stages when the sheet closes unless a stage targets the closed id", async () => {
    const { engine } = makeWithScreen("peek");
    const card = document.createElement("div");
    engine.setScrimStages({
      stages: [{ for: ["peek", "full"], element: card, animation: "none" }],
    });
    expect(card.parentElement!.style.visibility).not.toBe("hidden");
    await engine.close();
    await settle();
    expect(card.parentElement!.style.visibility).toBe("hidden");
    engine.destroy();
  });

  it("replaces a previous stages installation and tears down on destroy", () => {
    const { engine } = makeWithScreen("peek");
    const first = document.createElement("div");
    const second = document.createElement("div");
    engine.setScrimStages({ stages: [{ for: "peek", element: first }] });
    const firstWrapper = first.parentElement!;
    engine.setScrimStages({ stages: [{ for: "peek", element: second }] });
    expect(firstWrapper.isConnected).toBe(false);
    const secondWrapper = second.parentElement!;
    expect(secondWrapper.isConnected).toBe(true);
    engine.destroy();
    expect(secondWrapper.isConnected).toBe(false);
  });

  it("respects per-stage and shared positions", () => {
    const { engine } = makeWithScreen("peek");
    const a = document.createElement("div");
    const b = document.createElement("div");
    engine.setScrimStages({
      position: "top-center",
      stages: [
        { for: "peek", element: a },
        { for: "full", element: b, position: "bottom-left" },
      ],
    });
    expect(a.parentElement!.style.left).toBe("50%");
    expect(b.parentElement!.style.bottom).toBe("16px");
    expect(b.parentElement!.style.left).toBe("16px");
    engine.destroy();
  });
});
