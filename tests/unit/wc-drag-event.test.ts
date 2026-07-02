// @vitest-environment happy-dom

import { describe, expect, it, beforeEach } from "vitest";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import type { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import type { SheetEventMap } from "../../src/core/types";

type EngineEmit = {
  emit<K extends keyof SheetEventMap>(event: K, payload: SheetEventMap[K]): void;
};

const makeElement = () => {
  const el = document.createElement("bottom-sheet") as HTMLElement & {
    snapTo?: (id: string) => Promise<void>;
    getEngine?: () => BottomSheetEngine | null;
  };
  el.setAttribute(
    "snap-points",
    '[{"id":"a","size":100},{"id":"b","size":200}]',
  );
  el.setAttribute("initial", "a");
  document.body.appendChild(el);
  return el;
};

describe("<bottom-sheet> drag CustomEvent wiring", () => {
  beforeEach(async () => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    const { defineBottomSheet } = await import(
      "../../src/web-component/BottomSheetElement"
    );
    defineBottomSheet();
  });

  it("bridges engine 'drag' to a 'drag' CustomEvent carrying detail", () => {
    const el = makeElement();
    const engine = el.getEngine?.();
    expect(engine).toBeTruthy();

    const seen: Array<{ size: number; delta: number }> = [];
    el.addEventListener("drag", (e: Event) => {
      seen.push((e as CustomEvent<{ size: number; delta: number }>).detail);
    });

    (engine as unknown as EngineEmit).emit("drag", { size: 150, delta: -20 });

    expect(seen.length).toBe(1);
    expect(seen[0]).toEqual({ size: 150, delta: -20 });

    document.body.removeChild(el);
  });

  it("dispatches 'progress' CustomEvents per applySize while snapping", async () => {
    const el = makeElement();

    const progressDetails: Array<{ value: number; size: number }> = [];
    el.addEventListener("progress", (e: Event) => {
      progressDetails.push(
        (e as CustomEvent<{ value: number; size: number }>).detail,
      );
    });

    await el.snapTo?.("b");

    expect(progressDetails.length).toBeGreaterThan(0);
    expect(progressDetails.at(-1)).toHaveProperty("value");
    expect(progressDetails.at(-1)).toHaveProperty("size");

    document.body.removeChild(el);
  });
});
