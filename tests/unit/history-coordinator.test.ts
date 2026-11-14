import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { OverlayEngine } from "../../src/core/overlay";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import {
  __resetHistoryCoordinatorForTests,
  historySettled,
  pushBackMarker,
  popBackMarker,
  type BackSurface,
} from "../../src/core/features/history-coordinator";

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

const sheetOpts = (
  n: ReturnType<typeof makeSheet>,
  extra: Record<string, unknown> = {},
) => ({
  element: n.sheet,
  handle: n.handle,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "full", size: 400 },
  ],
  initial: "closed" as const,
  animation: "tween" as const,
  duration: 0,
  respectReducedMotion: false,
  ...extra,
});

const makeOverlayDom = () => {
  const panel = document.createElement("section");
  const backdrop = document.createElement("div");
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
  return { panel, backdrop };
};

const stateOf = (): Record<string, unknown> =>
  (history.state ?? {}) as Record<string, unknown>;

let page = 0;
let baseHref = "";

beforeEach(() => {
  __resetHistoryCoordinatorForTests();
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
  page += 1;
  history.pushState(null, "", `/coordinator-${page}`);
  baseHref = location.href;
});

afterEach(() => {
  __resetHistoryCoordinatorForTests();
  vi.restoreAllMocks();
});

describe("history-coordinator — mixed sheet + overlay back stack", () => {
  it("one hardware Back closes only the top overlay; a second closes the sheet", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(sheetOpts(s, { closeOnBack: true }));
    const { panel } = makeOverlayDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0, closeOnBack: true });
    await sheet.open("full");
    await ovl.open();
    await settle();
    expect(sheet.state.size).toBeGreaterThan(0);
    expect(ovl.state.isOpen).toBe(true);

    history.back();
    await settle();
    expect(ovl.state.isOpen).toBe(false);
    expect(sheet.state.size).toBeGreaterThan(0);

    history.back();
    await settle();
    expect(sheet.state.size).toBe(0);
    expect(location.href).toBe(baseHref);

    sheet.destroy();
    ovl.destroy();
  });

  it("programmatic close of the bottom sheet keeps the overlay and exactly one marker", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(sheetOpts(s, { closeOnBack: true }));
    const { panel } = makeOverlayDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0, closeOnBack: true });
    await sheet.open("full");
    await ovl.open();
    await settle();

    await sheet.close();
    await settle();

    expect(sheet.state.size).toBe(0);
    expect(ovl.state.isOpen).toBe(true);
    expect(stateOf().__bsDepth).toBe(1);
    expect(stateOf().__bsOverlay).toEqual(expect.any(String));
    expect(stateOf().__bsSheet).toBeUndefined();

    const back = vi.spyOn(history, "back");
    history.back();
    await settle();
    expect(ovl.state.isOpen).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(stateOf().__bs).toBeUndefined();

    sheet.destroy();
    ovl.destroy();
  });

  it("programmatic close of the top overlay keeps the sheet; next Back closes the sheet", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(sheetOpts(s, { closeOnBack: true }));
    const { panel } = makeOverlayDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0, closeOnBack: true });
    await sheet.open("full");
    await ovl.open();
    await settle();

    await ovl.close();
    await settle();

    expect(ovl.state.isOpen).toBe(false);
    expect(sheet.state.size).toBeGreaterThan(0);
    expect(stateOf().__bsDepth).toBe(1);
    expect(stateOf().__bsSheet).toEqual(expect.any(String));

    history.back();
    await settle();
    expect(sheet.state.size).toBe(0);

    sheet.destroy();
    ovl.destroy();
  });

  it("two sheets closed in the same tick leave the history on the entry below both", async () => {
    const lower = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnBack: true }),
    );
    const upper = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnBack: true }),
    );
    await lower.open("full");
    await upper.open("full");
    void lower.close();
    void upper.close();
    await historySettled();
    await settle();
    expect(location.href).toBe(baseHref);
    expect(stateOf().__bs).toBeUndefined();
    lower.destroy();
    upper.destroy();
  });
});

describe("history-coordinator — cancelable before-close", () => {
  it("a cancelled before-close restores exactly one marker; removing it lets the next Back close", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(sheetOpts(s, { closeOnBack: true }));
    await sheet.open("full");
    await settle();

    const cancel = (p: { cancel: () => void }) => p.cancel();
    const off = sheet.on("before-close", cancel);

    const push = vi.spyOn(history, "pushState");
    history.back();
    await settle();

    expect(sheet.state.size).toBeGreaterThan(0);
    expect(push).toHaveBeenCalledTimes(1);
    expect(stateOf().__bs).toBe(true);
    expect(stateOf().__bsDepth).toBe(1);

    off();
    history.back();
    await settle();
    expect(sheet.state.size).toBe(0);

    sheet.destroy();
  });
});

describe("history-coordinator — routed middle-close URL restore", () => {
  it("closing a routed middle sheet reverts the surviving marker URL to the pre-route URL", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const sheetA = new BottomSheetEngine(
      sheetOpts(a, { closeOnBack: true, routedTo: "#sheet-a" }),
    );
    const sheetB = new BottomSheetEngine(sheetOpts(b, { closeOnBack: true }));
    await sheetA.open("full");
    await sheetB.open("full");
    await settle();
    expect(location.hash).toBe("#sheet-a");

    await sheetA.close();
    await settle();

    expect(location.href).toBe(baseHref);
    expect(stateOf().__bsSheet).toEqual(expect.any(String));
    expect(stateOf().__bsRouted).toBeUndefined();
    expect(sheetA.state.size).toBe(0);
    expect(sheetB.state.size).toBeGreaterThan(0);

    history.back();
    await settle();
    expect(sheetB.state.size).toBe(0);

    sheetA.destroy();
    sheetB.destroy();
  });
});

describe("history-coordinator — closeOnRouteChange ref-counted patch", () => {
  it("restores exact history identities in LIFO and non-LIFO destroy, and re-mounts", async () => {
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    const e1 = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    const e2 = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    expect(history.pushState).not.toBe(origPush);

    e2.destroy();
    expect(history.pushState).not.toBe(origPush);
    e1.destroy();
    expect(history.pushState).toBe(origPush);
    expect(history.replaceState).toBe(origReplace);

    const e3 = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    const e4 = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    e3.destroy();
    e4.destroy();
    expect(history.pushState).toBe(origPush);
    expect(history.replaceState).toBe(origReplace);

    const e5 = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    await e5.open("full");
    await settle();
    expect(e5.state.size).toBeGreaterThan(0);
    history.pushState(null, "", `/coordinator-${page}/next`);
    await settle();
    expect(e5.state.size).toBe(0);
    e5.destroy();
  });

  it("one external route change closes all open closeOnRouteChange sheets", async () => {
    const e1 = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    const e2 = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    await e1.open("full");
    await e2.open("full");
    await settle();
    expect(e1.state.size).toBeGreaterThan(0);
    expect(e2.state.size).toBeGreaterThan(0);

    history.pushState(null, "", `/coordinator-${page}/next`);
    await settle();
    expect(e1.state.size).toBe(0);
    expect(e2.state.size).toBe(0);

    e1.destroy();
    e2.destroy();
  });

  it("a Back press that leaves the page closes a closeOnRouteChange sheet", async () => {
    const sheet = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    await sheet.open("full");
    history.back();
    await settle();
    expect(sheet.state.size).toBe(0);
    sheet.destroy();
  });

  it("a closeOnBack marker push does not trigger closeOnRouteChange siblings", async () => {
    const both = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnBack: true, closeOnRouteChange: true }),
    );
    await both.open("full");
    await settle();
    expect(both.state.size).toBeGreaterThan(0);

    const sibling = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnBack: true, routedTo: "#sibling" }),
    );
    await sibling.open("full");
    await settle();
    expect(both.state.size).toBeGreaterThan(0);
    expect(sibling.state.size).toBeGreaterThan(0);

    both.destroy();
    sibling.destroy();
  });

  it("the coordinator's own back() does not notify closeOnRouteChange subscribers", async () => {
    const back = vi.spyOn(history, "back");
    const withBack = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnBack: true, routedTo: "#routed" }),
    );
    const withRoute = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnRouteChange: true }),
    );
    await withBack.open("full");
    await withRoute.open("full");
    await settle();

    await withBack.close();
    await settle();

    expect(withBack.state.size).toBe(0);
    expect(withRoute.state.size).toBeGreaterThan(0);
    expect(back).toHaveBeenCalledTimes(1);

    withBack.destroy();
    withRoute.destroy();
  });
});

describe("history-coordinator — overlay marker leak on destroy", () => {
  it("destroying an open closeOnBack overlay pops its marker with no leak", async () => {
    const origPush = history.pushState;
    const back = vi.spyOn(history, "back");
    const { panel } = makeOverlayDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0, closeOnBack: true });
    await ovl.open();
    await settle();
    expect(stateOf().__bs).toBe(true);

    ovl.destroy();
    await settle();

    expect(back).toHaveBeenCalledTimes(1);
    expect(stateOf().__bs).toBeUndefined();
    expect(location.href).toBe(baseHref);
    expect(history.pushState).toBe(origPush);
  });
});

describe("history-coordinator — public __bs marker discriminator", () => {
  it("stamps __bs:true on a pushed closeOnBack sheet marker", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(sheetOpts(s, { closeOnBack: true }));
    await sheet.open("full");
    await settle();

    expect(stateOf()).toMatchObject({
      __bsSheet: expect.any(String),
      __bs: true,
    });

    sheet.destroy();
  });

  it("does not mark the entry the sheet was opened from as a marker", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(sheetOpts(s, { closeOnBack: true }));
    await sheet.open("full");
    await sheet.close();
    await settle();

    expect(stateOf().__bs).toBeUndefined();
    expect(stateOf().__bsSheet).toBeUndefined();

    sheet.destroy();
  });

  it("stamps __bs:true on a pushed routed sheet marker", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(
      sheetOpts(s, { closeOnBack: true, routedTo: "#routed" }),
    );
    await sheet.open("full");
    await settle();

    expect(stateOf()).toMatchObject({
      __bsRouted: expect.any(String),
      __bs: true,
    });

    sheet.destroy();
  });

  it("stamps __bs:true on a pushed overlay marker", async () => {
    const { panel } = makeOverlayDom();
    const ovl = new OverlayEngine({
      element: panel,
      duration: 0,
      closeOnBack: true,
    });
    await ovl.open();
    await settle();

    expect(stateOf()).toMatchObject({
      __bsOverlay: expect.any(String),
      __bs: true,
    });

    ovl.destroy();
  });

  it("stamps __bs:true on the marker restored after a cancelled before-close", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(sheetOpts(s, { closeOnBack: true }));
    await sheet.open("full");
    await settle();

    const off = sheet.on("before-close", p => p.cancel());
    history.back();
    await settle();

    expect(sheet.state.size).toBeGreaterThan(0);
    expect(stateOf()).toMatchObject({
      __bsSheet: expect.any(String),
      __bs: true,
    });

    off();
    sheet.destroy();
  });

  it("stamps __bs:true on the rebrand replaceState of a surviving marker", async () => {
    const a = makeSheet();
    const b = makeSheet();
    const sheetA = new BottomSheetEngine(
      sheetOpts(a, { closeOnBack: true, routedTo: "#sheet-a" }),
    );
    const sheetB = new BottomSheetEngine(sheetOpts(b, { closeOnBack: true }));
    await sheetA.open("full");
    await sheetB.open("full");
    await settle();

    const replace = vi.spyOn(history, "replaceState");
    await sheetA.close();
    await settle();

    expect(replace).toHaveBeenCalled();
    expect(stateOf()).toMatchObject({
      __bsSheet: expect.any(String),
      __bs: true,
    });

    sheetA.destroy();
    sheetB.destroy();
  });
});

describe("history-coordinator — raw surfaces", () => {
  type Probe = BackSurface & { closeCalls: number; open: boolean };

  const mkSurface = (
    tag: string,
    overrides: Partial<BackSurface> = {},
  ): Probe => {
    const surface: Probe = {
      closeCalls: 0,
      open: true,
      isOpen: (): boolean => surface.open,
      close: (): void => {
        surface.closeCalls += 1;
        surface.open = false;
      },
      markerState: () => ({ __bsSheet: tag }),
      ...overrides,
    };
    return surface;
  };

  it("closing two lower surfaces in one tick re-labels the entry that is left for the survivor", async () => {
    const a = mkSurface("qa", { url: "#queue-a" });
    const b = mkSurface("qb");
    const c = mkSurface("qc");
    const hA = pushBackMarker(a);
    const hB = pushBackMarker(b);
    pushBackMarker(c);

    void popBackMarker(hA);
    void popBackMarker(hB);
    await historySettled();
    await settle();

    expect(stateOf()).toMatchObject({ __bsSheet: "qc", __bs: true });
    expect(stateOf().__bsDepth).toBe(1);
    expect(location.href).toBe(baseHref);
    expect(c.closeCalls).toBe(0);

    history.back();
    await settle();
    expect(c.closeCalls).toBe(1);
  });

  it("a back() that throws does not leave callers waiting for the history", async () => {
    const back = vi.spyOn(history, "back").mockImplementationOnce(() => {
      throw new Error("no-entry");
    });
    const a = mkSurface("ta");
    const handle = pushBackMarker(a);

    await popBackMarker(handle);
    expect(back).toHaveBeenCalledTimes(1);

    const b = mkSurface("tb");
    pushBackMarker(b);
    expect(stateOf()).toMatchObject({ __bsSheet: "tb", __bs: true });
    history.back();
    await settle();
    expect(b.closeCalls).toBe(1);
  });
});
