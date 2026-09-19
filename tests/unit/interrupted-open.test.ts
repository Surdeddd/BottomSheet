import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const makeSheet = () => {
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  sheet.appendChild(handle);
  document.body.appendChild(sheet);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { sheet, handle };
};

const build = (n: ReturnType<typeof makeSheet>) =>
  new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: 300 },
      { id: "full", size: 600 },
    ],
    initial: "closed",
    animation: "tween",
    duration: 160,
    respectReducedMotion: false,
  });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const record = (engine: BottomSheetEngine) => {
  const events: string[] = [];
  engine.on("open", () => events.push("open"));
  engine.on("opened", () => events.push("opened"));
  engine.on("close", () => events.push("close"));
  engine.on("closed", () => events.push("closed"));
  return events;
};

describe("an open that is redirected before it lands", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
    document.body.removeAttribute("style");
  });

  it("still announces the open once when snapTo retargets it mid-flight", async () => {
    const n = makeSheet();
    const engine = build(n);
    const events = record(engine);

    void engine.open("half");
    await sleep(40);
    await engine.snapTo("full");

    expect(engine.state.activeId).toBe("full");
    expect(events.filter(e => e === "open")).toHaveLength(1);
    expect(events.filter(e => e === "opened")).toHaveLength(1);
    engine.destroy();
  });

  it("locks body scroll for a sheet whose open was retargeted", async () => {
    const n = makeSheet();
    const engine = build(n);

    void engine.open("half");
    await sleep(40);
    await engine.snapTo("full");

    expect(document.body.style.overflow).toBe("hidden");
    engine.destroy();
  });

  it("releases that scroll lock again when the sheet closes", async () => {
    const n = makeSheet();
    const engine = build(n);

    void engine.open("half");
    await sleep(40);
    await engine.snapTo("full");
    await engine.close();

    expect(document.body.style.overflow).not.toBe("hidden");
    engine.destroy();
  });

  it("announces once even when retargeted twice before landing", async () => {
    const n = makeSheet();
    const engine = build(n);
    const events = record(engine);

    void engine.open("half");
    await sleep(30);
    void engine.snapTo("full");
    await sleep(30);
    await engine.snapTo("half");

    expect(engine.state.activeId).toBe("half");
    expect(events.filter(e => e === "open")).toHaveLength(1);
    expect(events.filter(e => e === "opened")).toHaveLength(1);
    engine.destroy();
  });

  it("does not announce an open for a snap between two open points", async () => {
    const n = makeSheet();
    const engine = build(n);
    await engine.open("half");
    const events = record(engine);

    await engine.snapTo("full");

    expect(events).toEqual([]);
    engine.destroy();
  });

  it("does not lift a retargeted sheet above one opened after it", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const engineA = build(a);
    const engineB = build(b);

    void engineA.open("half");
    await sleep(30);
    void engineB.open("half");
    await sleep(20);
    await engineA.snapTo("full");
    await sleep(200);

    expect(engineB.isTop()).toBe(true);
    expect(parseInt(b.sheet.style.zIndex, 10)).toBeGreaterThan(
      parseInt(a.sheet.style.zIndex, 10),
    );
    engineA.destroy();
    engineB.destroy();
  });

  it("closing mid-open still ends closed and holds no scroll lock", async () => {
    const n = makeSheet();
    const engine = build(n);

    void engine.open("half");
    await sleep(40);
    await engine.close();

    expect(engine.state.size).toBe(0);
    expect(document.body.style.overflow).not.toBe("hidden");
    engine.destroy();
  });
});
