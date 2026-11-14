import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { historySettled } from "../../src/core/features/history-coordinator";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";

const tick = () => new Promise(r => setTimeout(r, 20));

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

const build = (extra: Record<string, unknown> = {}) => {
  const nodes = makeSheet();
  return new BottomSheetEngine({
    element: nodes.sheet,
    handle: nodes.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "full", size: 400 },
    ],
    initial: "closed",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
    closeOnBack: true,
    ...extra,
  });
};

const stateOf = (): Record<string, unknown> =>
  (history.state ?? {}) as Record<string, unknown>;

let path = 0;

beforeEach(() => {
  __resetRouteCoordinatorForTests();
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  document.body.removeAttribute("style");
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
  path += 1;
  history.pushState(null, "", `/page-${path}`);
});

afterEach(() => {
  __resetRouteCoordinatorForTests();
  vi.restoreAllMocks();
});

describe("the sheet's history entry", () => {
  it("keeps what the router stored in the entry it was opened from", async () => {
    history.replaceState(
      { back: null, current: `/page-${path}`, position: 7 },
      "",
    );
    const engine = build();
    await engine.open("full");
    expect(stateOf().__bs).toBe(true);
    expect(stateOf().current).toBe(`/page-${path}`);
    expect(stateOf().position).toBe(7);
    engine.destroy();
  });

  it("keeps the router's fields when a cancelled close puts the entry back", async () => {
    history.replaceState({ current: `/page-${path}`, position: 2 }, "");
    const engine = build();
    engine.on("before-close", e => e.cancel());
    await engine.open("full");
    history.back();
    await tick();
    expect(engine.state.size).toBe(400);
    expect(stateOf().__bs).toBe(true);
    expect(stateOf().current).toBe(`/page-${path}`);
    engine.destroy();
  });

  it("leaves the entry underneath usable by the router after the sheet closes", async () => {
    history.replaceState({ current: `/page-${path}`, position: 2 }, "");
    const engine = build();
    await engine.open("full");
    await engine.close();
    expect(stateOf().__bs).toBeUndefined();
    expect(stateOf().current).toBe(`/page-${path}`);
    expect(stateOf().position).toBe(2);
    engine.destroy();
  });
});

describe("re-labelling the entry that is left", () => {
  it("keeps the router's fields when the lower of two sheets closes", async () => {
    history.replaceState({ current: `/page-${path}`, position: 4 }, "");
    const lower = build();
    const upper = build();
    await lower.open("full");
    await upper.open("full");
    await lower.close();
    await historySettled();
    await tick();
    expect(upper.state.size).toBe(400);
    expect(stateOf().__bs).toBe(true);
    expect(stateOf().__bsDepth).toBe(1);
    expect(stateOf().current).toBe(`/page-${path}`);
    expect(stateOf().position).toBe(4);
    lower.destroy();
    upper.destroy();
  });

  it("does not let Forward onto a spent entry reopen or close anything", async () => {
    const lower = build();
    const upper = build();
    await lower.open("full");
    await upper.open("full");
    history.back();
    await tick();
    expect(upper.state.size).toBe(0);

    history.forward();
    await tick();
    expect(upper.state.size).toBe(0);
    expect(lower.state.size).toBe(400);

    history.back();
    await tick();
    expect(lower.state.size).toBe(400);
    lower.destroy();
    upper.destroy();
  });
});

describe("closing never undoes the app's own navigation", () => {
  it("does not step back when the app pushed a route over the open sheet", async () => {
    const back = vi.spyOn(history, "back");
    const engine = build();
    await engine.open("full");
    history.pushState({ app: true }, "", "/next");
    await engine.close();
    await historySettled();
    expect(back).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/next");
    expect(stateOf().app).toBe(true);
    engine.destroy();
  });

  it("does not step back when the sheet is destroyed after the app navigated", async () => {
    const back = vi.spyOn(history, "back");
    const engine = build();
    await engine.open("full");
    history.pushState({ app: true }, "", "/next");
    engine.destroy();
    await historySettled();
    expect(back).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/next");
  });

  it("skips its dead entry when the user later walks back over it", async () => {
    const engine = build();
    await engine.open("full");
    history.pushState({ app: true }, "", "/next");
    await engine.close();
    history.back();
    await tick();
    expect(location.pathname).toBe(`/page-${path}`);
    expect(stateOf().__bs).toBeUndefined();
    engine.destroy();
  });

  it("lets the caller wait for the history to settle after a close", async () => {
    const engine = build();
    await engine.open("full");
    await engine.close();
    history.pushState({ app: true }, "", "/after-close");
    await historySettled();
    await tick();
    expect(location.pathname).toBe("/after-close");
    expect(stateOf().app).toBe(true);
    engine.destroy();
  });
});

describe("Back and other history events", () => {
  it("closes the sheet on Back and leaves the history on the entry below", async () => {
    const engine = build();
    await engine.open("full");
    history.back();
    await tick();
    expect(engine.state.size).toBe(0);
    expect(location.pathname).toBe(`/page-${path}`);
    expect(stateOf().__bs).toBeUndefined();
    engine.destroy();
  });

  it("closes only the upper of two sheets on one Back", async () => {
    const lower = build();
    const upper = build();
    await lower.open("full");
    await upper.open("full");
    history.back();
    await tick();
    expect(upper.state.size).toBe(0);
    expect(lower.state.size).toBe(400);
    history.back();
    await tick();
    expect(lower.state.size).toBe(0);
    lower.destroy();
    upper.destroy();
  });

  it("keeps the sheet open when a link inside it changes the hash", async () => {
    const engine = build();
    await engine.open("full");
    history.pushState(null, "", "#details");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    await tick();
    expect(engine.state.size).toBe(400);
    engine.destroy();
  });

  it("closes on one Back even when it was opened over a marker left by the previous page load", async () => {
    history.pushState(
      { __bs: true, __bsSheet: "gone", __bsStack: "old", __bsDepth: 1 },
      "",
    );
    const engine = build({ initial: "full" });
    expect(stateOf().__bs).toBe(true);
    expect(stateOf().__bsSheet).not.toBe("gone");
    history.back();
    await tick();
    expect(engine.state.size).toBe(0);
    expect(stateOf().__bs).toBeUndefined();
    expect(location.pathname).toBe(`/page-${path}`);
    engine.destroy();
  });

  it("steps off a marker left by the previous page load when no sheet is open", async () => {
    history.pushState(
      { __bs: true, __bsSheet: "gone", __bsStack: "old", __bsDepth: 1 },
      "",
    );
    const engine = build();
    await tick();
    expect(stateOf().__bs).toBeUndefined();
    expect(location.pathname).toBe(`/page-${path}`);
    engine.destroy();
  });
});

describe("routed sheets", () => {
  it("keeps the routed address when the sheet under it closes", async () => {
    const lower = build();
    const upper = build({ routedTo: "/sheet/details" });
    await lower.open("full");
    await upper.open("full");
    expect(location.pathname).toBe("/sheet/details");
    await lower.close();
    await historySettled();
    await tick();
    expect(upper.state.size).toBe(400);
    expect(location.pathname).toBe("/sheet/details");
    lower.destroy();
    upper.destroy();
  });
});

describe("closeOnRouteChange", () => {
  it("ignores a History API call that leaves the address as it is", async () => {
    const engine = build({ closeOnBack: false, closeOnRouteChange: true });
    await engine.open("full");
    history.replaceState({ scroll: 120 }, "", location.href);
    await tick();
    expect(engine.state.size).toBe(400);
    engine.destroy();
  });

  it("closes when the app navigates to another address", async () => {
    const engine = build({ closeOnBack: false, closeOnRouteChange: true });
    await engine.open("full");
    history.pushState(null, "", "/elsewhere");
    await tick();
    expect(engine.state.size).toBe(0);
    engine.destroy();
  });

  it("keeps pushState working when another script wrapped it after us", async () => {
    const first = build({ closeOnBack: false, closeOnRouteChange: true });
    const ours = history.pushState;
    const calls: string[] = [];
    history.pushState = function (this: History, ...args) {
      calls.push(String(args[2]));
      return ours.apply(this, args);
    } as History["pushState"];
    first.destroy();
    expect(() => history.pushState(null, "", "/a")).not.toThrow();

    const second = build({ closeOnBack: false, closeOnRouteChange: true });
    await second.open("full");
    expect(() => history.pushState(null, "", "/b")).not.toThrow();
    await tick();
    expect(second.state.size).toBe(0);
    expect(calls).toEqual(["/a", "/b"]);
    second.destroy();
    history.pushState = ours;
  });
});
