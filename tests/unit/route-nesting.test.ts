import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";

const settle = () => new Promise(r => setTimeout(r, 30));

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

const opts = (n: ReturnType<typeof makeSheet>) => ({
  element: n.sheet,
  handle: n.handle,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "full", size: 400 },
  ],
  initial: "closed" as const,
  closeOnBack: true,
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
});

describe("closeOnBack — nested sheets", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    __resetRouteCoordinatorForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
  });

  it("a real Back press closes only the top sheet, parent stays open", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const parent = new BottomSheetEngine(opts(a));
    const nested = new BottomSheetEngine(opts(b));
    await parent.open("full");
    await nested.open("full");
    await settle();
    expect(parent.state.size).toBeGreaterThan(0);
    expect(nested.state.size).toBeGreaterThan(0);

    window.dispatchEvent(new Event("popstate"));
    await settle();

    expect(nested.state.size).toBe(0);
    expect(parent.state.size).toBeGreaterThan(0);
    parent.destroy();
    nested.destroy();
  });

  it("programmatically closing the nested sheet does NOT close the parent", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const parent = new BottomSheetEngine(opts(a));
    const nested = new BottomSheetEngine(opts(b));
    await parent.open("full");
    await nested.open("full");
    await settle();

    await nested.close();
    await settle();

    expect(nested.state.size).toBe(0);
    expect(parent.state.size).toBeGreaterThan(0);
    parent.destroy();
    nested.destroy();
  });

  it("a second Back press closes the parent after the nested sheet is gone", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const parent = new BottomSheetEngine(opts(a));
    const nested = new BottomSheetEngine(opts(b));
    await parent.open("full");
    await nested.open("full");
    await settle();

    window.dispatchEvent(new Event("popstate"));
    await settle();
    window.dispatchEvent(new Event("popstate"));
    await settle();

    expect(nested.state.size).toBe(0);
    expect(parent.state.size).toBe(0);
    parent.destroy();
    nested.destroy();
  });
});
