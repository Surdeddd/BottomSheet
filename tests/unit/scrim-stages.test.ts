import { describe, expect, it, beforeEach } from "vitest";
import {
  installScrimStages,
  type ScrimStagesDeps,
} from "../../src/core/features/scrim-stages";
import type { SheetEventMap } from "../../src/core/types";

type BusEvent = keyof SheetEventMap;

const microtask = () => Promise.resolve();

const makeHarness = (
  initial: { activeId: string; size: number; progress: number },
) => {
  const listeners = new Map<BusEvent, Set<(p: unknown) => void>>();
  const state = { ...initial };
  const host = document.createElement("div");
  document.body.appendChild(host);
  let destroyed = false;

  const deps: ScrimStagesDeps = {
    mode: "bottom",
    host,
    getState: () => ({ ...state }),
    on: (event, fn) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      const wrapped = fn as (p: unknown) => void;
      set.add(wrapped);
      return () => set!.delete(wrapped);
    },
    isDestroyed: () => destroyed,
  };

  const emit = (event: BusEvent): void => {
    listeners.get(event)?.forEach(fn => fn(undefined));
  };
  const subscribed = (event: BusEvent): boolean =>
    (listeners.get(event)?.size ?? 0) > 0;
  const setState = (next: Partial<typeof state>): void => {
    Object.assign(state, next);
  };

  return {
    deps,
    host,
    emit,
    subscribed,
    setState,
    destroy: () => {
      destroyed = true;
    },
  };
};

const visible = (el: HTMLElement): boolean =>
  el.parentElement!.style.visibility !== "hidden";

describe("installScrimStages (fake bus)", () => {
  beforeEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("'for'-id stage shows on the matching snap and hides otherwise", async () => {
    const h = makeHarness({ activeId: "peek", size: 120, progress: 0.2 });
    const teaser = document.createElement("div");
    const promo = document.createElement("div");
    const detach = installScrimStages(h.deps, {
      stages: [
        { for: "peek", element: teaser, animation: "none" },
        { for: "full", element: promo, animation: "none" },
      ],
    });

    expect(visible(teaser)).toBe(true);
    expect(visible(promo)).toBe(false);

    h.setState({ activeId: "full", size: 800, progress: 1 });
    h.emit("snap");
    await microtask();

    expect(visible(teaser)).toBe(false);
    expect(visible(promo)).toBe(true);

    detach();
  });

  it("forRange toggles across the progress range, and progress is only subscribed when ranges exist", async () => {
    const withRange = makeHarness({
      activeId: "mid",
      size: 300,
      progress: 0.3,
    });
    const low = document.createElement("div");
    const detachRange = installScrimStages(withRange.deps, {
      stages: [{ forRange: [0, 0.5], element: low, animation: "none" }],
    });
    expect(withRange.subscribed("progress")).toBe(true);
    expect(visible(low)).toBe(true);

    withRange.setState({ progress: 0.9 });
    withRange.emit("progress");
    await microtask();
    expect(visible(low)).toBe(false);

    withRange.setState({ progress: 0.3 });
    withRange.emit("progress");
    await microtask();
    expect(visible(low)).toBe(true);
    detachRange();

    const idOnly = makeHarness({ activeId: "peek", size: 120, progress: 0.2 });
    const card = document.createElement("div");
    const detachId = installScrimStages(idOnly.deps, {
      stages: [{ for: "peek", element: card, animation: "none" }],
    });
    expect(idOnly.subscribed("progress")).toBe(false);
    detachId();
  });

  it("'for' id-match wins over forRange when both would match", async () => {
    const h = makeHarness({ activeId: "peek", size: 120, progress: 0.2 });
    const byId = document.createElement("div");
    const byRange = document.createElement("div");
    const detach = installScrimStages(h.deps, {
      stages: [
        { for: "peek", element: byId, animation: "none" },
        { forRange: [0, 0.5], element: byRange, animation: "none" },
      ],
    });

    expect(visible(byId)).toBe(true);
    expect(visible(byRange)).toBe(false);

    detach();
  });

  it("with size 0 only an id-matched stage shows (range stages stay hidden)", async () => {
    const h = makeHarness({ activeId: "closed", size: 0, progress: 0 });
    const closedStage = document.createElement("div");
    const rangeStage = document.createElement("div");
    const detach = installScrimStages(h.deps, {
      stages: [
        { for: "closed", element: closedStage, animation: "none" },
        { forRange: [0, 0.5], element: rangeStage, animation: "none" },
      ],
    });

    expect(visible(closedStage)).toBe(true);
    expect(visible(rangeStage)).toBe(false);

    h.setState({ activeId: "peek", size: 120, progress: 0.2 });
    h.emit("snap");
    await microtask();
    expect(visible(closedStage)).toBe(false);
    expect(visible(rangeStage)).toBe(true);

    detach();
  });

  it("teardown removes all stage wrappers", () => {
    const h = makeHarness({ activeId: "peek", size: 120, progress: 0.2 });
    const a = document.createElement("div");
    const b = document.createElement("div");
    const detach = installScrimStages(h.deps, {
      stages: [
        { for: "peek", element: a, animation: "none" },
        { for: "full", element: b, animation: "none" },
      ],
    });
    const wrapperA = a.parentElement!;
    const wrapperB = b.parentElement!;
    expect(wrapperA.isConnected).toBe(true);
    expect(wrapperB.isConnected).toBe(true);

    detach();

    expect(wrapperA.isConnected).toBe(false);
    expect(wrapperB.isConnected).toBe(false);
  });
});
