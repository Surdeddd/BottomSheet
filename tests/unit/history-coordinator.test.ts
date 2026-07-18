import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { MockInstance } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { OverlayEngine } from "../../src/core/overlay";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import {
  __resetHistoryCoordinatorForTests,
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

let pushSpy: MockInstance;
let backSpy: MockInstance;

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
  pushSpy = vi.spyOn(history, "pushState");
  backSpy = vi.spyOn(history, "back").mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
});

afterEach(() => {
  __resetHistoryCoordinatorForTests();
  vi.restoreAllMocks();
});

const netMarkers = (): number =>
  pushSpy.mock.calls.length - backSpy.mock.calls.length;

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

    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    expect(ovl.state.isOpen).toBe(false);
    expect(sheet.state.size).toBeGreaterThan(0);

    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    expect(sheet.state.size).toBe(0);

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
    expect(netMarkers()).toBe(1);

    const backsAfterClose = backSpy.mock.calls.length;
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    expect(ovl.state.isOpen).toBe(false);
    expect(backSpy.mock.calls.length).toBe(backsAfterClose);

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
    expect(netMarkers()).toBe(1);

    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    expect(sheet.state.size).toBe(0);

    sheet.destroy();
    ovl.destroy();
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

    const pushesBefore = pushSpy.mock.calls.length;
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();

    expect(sheet.state.size).toBeGreaterThan(0);
    expect(pushSpy.mock.calls.length - pushesBefore).toBe(1);

    off();
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    expect(sheet.state.size).toBe(0);

    sheet.destroy();
  });
});

describe("history-coordinator — routed middle-close URL restore", () => {
  it("closing a routed middle sheet reverts the surviving marker URL to the pre-route URL", async () => {
    const replaceSpy = vi.spyOn(history, "replaceState");
    const hrefBefore = location.href;
    const a = makeSheet();
    const b = makeSheet();
    const sheetA = new BottomSheetEngine(
      sheetOpts(a, { closeOnBack: true, routedTo: "#sheet-a" }),
    );
    const sheetB = new BottomSheetEngine(sheetOpts(b, { closeOnBack: true }));
    await sheetA.open("full");
    await sheetB.open("full");
    await settle();

    replaceSpy.mockClear();
    await sheetA.close();
    await settle();

    const rebrand = replaceSpy.mock.calls.find(c => c[2] === hrefBefore);
    expect(rebrand).toBeDefined();
    expect(rebrand?.[0]).toMatchObject({ __bsSheet: expect.any(String) });
    expect(sheetA.state.size).toBe(0);
    expect(sheetB.state.size).toBeGreaterThan(0);

    window.dispatchEvent(new PopStateEvent("popstate"));
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
    history.pushState(null, "", location.href);
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

    history.pushState(null, "", location.href);
    await settle();
    expect(e1.state.size).toBe(0);
    expect(e2.state.size).toBe(0);

    e1.destroy();
    e2.destroy();
  });

  it("a closeOnBack marker push does not trigger closeOnRouteChange siblings", async () => {
    const both = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnBack: true, closeOnRouteChange: true }),
    );
    await both.open("full");
    await settle();
    expect(both.state.size).toBeGreaterThan(0);

    const sibling = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnBack: true }),
    );
    await sibling.open("full");
    await settle();
    expect(both.state.size).toBeGreaterThan(0);
    expect(sibling.state.size).toBeGreaterThan(0);

    both.destroy();
    sibling.destroy();
  });

  it("a suppressed coordinator back() does not notify closeOnRouteChange subscribers", async () => {
    const withBack = new BottomSheetEngine(
      sheetOpts(makeSheet(), { closeOnBack: true }),
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
    expect(backSpy).toHaveBeenCalled();

    withBack.destroy();
    withRoute.destroy();
  });
});

describe("history-coordinator — overlay marker leak on destroy", () => {
  it("destroying an open closeOnBack overlay pops its marker with no leak", async () => {
    const origPush = history.pushState;
    const { panel } = makeOverlayDom();
    const ovl = new OverlayEngine({ element: panel, duration: 0, closeOnBack: true });
    await ovl.open();
    await settle();

    const backsBefore = backSpy.mock.calls.length;
    ovl.destroy();
    await settle();

    expect(backSpy.mock.calls.length - backsBefore).toBe(1);
    expect(netMarkers()).toBe(0);
    expect(history.pushState).toBe(origPush);
  });
});

describe("history-coordinator — public __bs marker discriminator", () => {
  const findState = (
    spy: MockInstance,
    key: string,
  ): Record<string, unknown> | undefined => {
    const hit = spy.mock.calls.find(c => {
      const st = c[0] as Record<string, unknown> | null;
      return !!st && key in st;
    });
    return hit?.[0] as Record<string, unknown> | undefined;
  };

  it("stamps __bs:true on a pushed closeOnBack sheet marker", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(sheetOpts(s, { closeOnBack: true }));
    await sheet.open("full");
    await settle();

    expect(findState(pushSpy, "__bsSheet")).toMatchObject({
      __bsSheet: expect.any(String),
      __bs: true,
    });

    sheet.destroy();
  });

  it("stamps __bs:true on a pushed routed sheet marker", async () => {
    const s = makeSheet();
    const sheet = new BottomSheetEngine(
      sheetOpts(s, { closeOnBack: true, routedTo: "#routed" }),
    );
    await sheet.open("full");
    await settle();

    expect(findState(pushSpy, "__bsRouted")).toMatchObject({
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

    expect(findState(pushSpy, "__bsOverlay")).toMatchObject({
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
    pushSpy.mockClear();
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();

    expect(sheet.state.size).toBeGreaterThan(0);
    expect(findState(pushSpy, "__bsSheet")).toMatchObject({ __bs: true });

    off();
    sheet.destroy();
  });

  it("stamps __bs:true on the rebrand replaceState of a surviving marker", async () => {
    const replaceSpy = vi.spyOn(history, "replaceState");
    const a = makeSheet();
    const b = makeSheet();
    const sheetA = new BottomSheetEngine(
      sheetOpts(a, { closeOnBack: true, routedTo: "#sheet-a" }),
    );
    const sheetB = new BottomSheetEngine(sheetOpts(b, { closeOnBack: true }));
    await sheetA.open("full");
    await sheetB.open("full");
    await settle();

    replaceSpy.mockClear();
    await sheetA.close();
    await settle();

    expect(findState(replaceSpy, "__bsSheet")).toMatchObject({
      __bsSheet: expect.any(String),
      __bs: true,
    });

    sheetA.destroy();
    sheetB.destroy();
  });
});

describe("history-coordinator — pending-rebrand FIFO queue", () => {
  const mkSurface = (
    tag: string,
    overrides: Partial<BackSurface> = {},
  ): BackSurface & { closeCalls: number } => {
    const surface = {
      closeCalls: 0,
      isOpen: () => true,
      isTop: () => false,
      close: () => {
        surface.closeCalls += 1;
      },
      markerState: () => ({ __bsSheet: tag }),
      ...overrides,
    };
    return surface;
  };

  it("two same-tick middle closes run both rebrands, one per swallowed popstate", () => {
    const replaceSpy = vi.spyOn(history, "replaceState");
    backSpy.mockImplementation(() => {});

    const a = mkSurface("qa", { url: "#queue-a" } as Partial<BackSurface>);
    const b = mkSurface("qb");
    const c = mkSurface("qc");
    const hA = pushBackMarker(a);
    const hB = pushBackMarker(b);
    pushBackMarker(c);

    replaceSpy.mockClear();
    popBackMarker(hA);
    popBackMarker(hB);
    expect(replaceSpy.mock.calls.length).toBe(0);

    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(replaceSpy.mock.calls.length).toBe(2);
    expect(replaceSpy.mock.calls[0]?.[0]).toMatchObject({
      __bsSheet: "qc",
      __bs: true,
    });
    expect(replaceSpy.mock.calls[1]?.[0]).toMatchObject({
      __bsSheet: "qc",
      __bs: true,
    });
    expect(c.closeCalls).toBe(0);

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(c.closeCalls).toBe(1);
  });

  it("a throwing back() unwinds its queue slot without desyncing later rebrands", () => {
    const replaceSpy = vi.spyOn(history, "replaceState");
    backSpy
      .mockImplementationOnce(() => {
        throw new Error("no-entry");
      })
      .mockImplementation(() => {});

    const a = mkSurface("ta");
    const b = mkSurface("tb");
    const c = mkSurface("tc");
    const hA = pushBackMarker(a);
    const hB = pushBackMarker(b);
    pushBackMarker(c);

    replaceSpy.mockClear();
    popBackMarker(hA);
    expect(replaceSpy.mock.calls.length).toBe(0);

    popBackMarker(hB);
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(replaceSpy.mock.calls.length).toBe(1);
    expect(replaceSpy.mock.calls[0]?.[0]).toMatchObject({
      __bsSheet: "tc",
      __bs: true,
    });

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(c.closeCalls).toBe(1);
  });
});
