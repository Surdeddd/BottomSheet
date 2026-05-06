import { describe, expect, it, beforeEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import { makeDom as makeBaseDom } from "./_helpers/makeDom";

const stubPointerCapture = (el: HTMLElement) => {
  Object.assign(el, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
};

// Gestures-specific extension: the keyboard-dismiss tests need an `<input>`
// inside `content` so `document.activeElement` can be an editable, AND the
// sheet itself needs pointer-capture stubs (the engine calls them on `sheet`
// for the dismiss-keyboard codepath, not just on `handle`).
const makeDom = () => {
  const base = makeBaseDom();
  const input = document.createElement("input");
  input.type = "text";
  // happy-dom needs the input attached for `focus()` / `activeElement` to work.
  base.content.appendChild(input);
  stubPointerCapture(base.sheet);
  return { ...base, input };
};

const dispatchPointer = (
  target: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: PointerEventInit & { clientY?: number; clientX?: number; pointerType?: string },
) => {
  // happy-dom's PointerEvent honors the dictionary, but doesn't compute timeStamp
  // in a useful way; the gestures module reads `e.timeStamp` for velocity
  // sampling, and reading 0 across all samples produces dt=0 (no velocity) —
  // which is fine, since the keyboard-dismiss path doesn't depend on velocity.
  const e = new PointerEvent(type, {
    pointerId: 1,
    pointerType: "touch",
    bubbles: true,
    cancelable: true,
    ...init,
  } as PointerEventInit);
  target.dispatchEvent(e);
};

describe("gestures: drag-to-dismiss-keyboard", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true });
  });

  it("dragging dismissive direction blurs active input (touch only)", () => {
    const { sheet, handle, input } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 600 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    // Focus the input so the soft keyboard would (notionally) be open.
    input.focus();
    expect(document.activeElement).toBe(input);
    const blurSpy = vi.spyOn(input, "blur");

    // Mode "bottom", touch pointer, drag DOWN (clientY increases) = dismissive
    // (sheet shrinks because sign = -1 for bottom, so positive raw delta
    // becomes negative axis delta → next < dragStartSize).
    dispatchPointer(handle, "pointerdown", { clientY: 100, pointerType: "touch" });
    dispatchPointer(handle, "pointermove", { clientY: 200, pointerType: "touch" });

    expect(blurSpy).toHaveBeenCalledTimes(1);

    // Subsequent dismissive moves in the same drag must NOT re-blur.
    dispatchPointer(handle, "pointermove", { clientY: 250, pointerType: "touch" });
    expect(blurSpy).toHaveBeenCalledTimes(1);

    dispatchPointer(handle, "pointerup", { clientY: 250, pointerType: "touch" });
    blurSpy.mockRestore();
    engine.destroy();
  });

  it("does NOT blur on mouse pointer (no soft keyboard to dismiss)", () => {
    const { sheet, handle, input } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 600 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    input.focus();
    const blurSpy = vi.spyOn(input, "blur");

    dispatchPointer(handle, "pointerdown", { clientY: 100, pointerType: "mouse" });
    dispatchPointer(handle, "pointermove", { clientY: 200, pointerType: "mouse" });

    expect(blurSpy).not.toHaveBeenCalled();

    dispatchPointer(handle, "pointerup", { clientY: 200, pointerType: "mouse" });
    blurSpy.mockRestore();
    engine.destroy();
  });

  it("does NOT blur on expansive drag direction", () => {
    const { sheet, handle, input } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 600 },
      ],
      initial: "min",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    input.focus();
    const blurSpy = vi.spyOn(input, "blur");

    // Drag UP (clientY decreases) on a "bottom" sheet = expansive (sheet grows),
    // not dismissive — keyboard should remain.
    dispatchPointer(handle, "pointerdown", { clientY: 500, pointerType: "touch" });
    dispatchPointer(handle, "pointermove", { clientY: 300, pointerType: "touch" });

    expect(blurSpy).not.toHaveBeenCalled();

    dispatchPointer(handle, "pointerup", { clientY: 300, pointerType: "touch" });
    blurSpy.mockRestore();
    engine.destroy();
  });

  it("reuses the same payload object across drag emissions (no per-frame alloc)", () => {
    // Regression: GestureController mutates a single `{size, delta}` object
    // per drag instead of allocating per onMove. Asserts object identity is
    // preserved across multiple pointermoves so consumers can rely on the
    // documented contract (and so a future refactor that re-introduces
    // per-frame `{ size: next, delta }` literal allocation is caught).
    const { sheet, handle } = makeDom();
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 600 },
      ],
      initial: "min",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });

    const seen: Array<{ size: number; delta: number }> = [];
    engine.on("drag", payload => {
      seen.push(payload);
    });

    dispatchPointer(handle, "pointerdown", { clientY: 500, pointerType: "touch" });
    dispatchPointer(handle, "pointermove", { clientY: 480, pointerType: "touch" });
    dispatchPointer(handle, "pointermove", { clientY: 460, pointerType: "touch" });
    dispatchPointer(handle, "pointermove", { clientY: 440, pointerType: "touch" });
    dispatchPointer(handle, "pointerup", { clientY: 440, pointerType: "touch" });

    // At least two emissions are needed to compare identity meaningfully.
    expect(seen.length).toBeGreaterThanOrEqual(2);
    const first = seen[0];
    expect(first).toBeDefined();
    // All emitted payloads must be the SAME object reference.
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBe(first);
    }
    // Payload shape contract still holds — fields are numbers.
    expect(typeof first!.size).toBe("number");
    expect(typeof first!.delta).toBe("number");

    engine.destroy();
  });

  it("does NOT blur when active element is not an editable", () => {
    const { sheet, handle } = makeDom();
    // Focus a non-editable inside the sheet — a button.
    const btn = document.createElement("button");
    sheet.appendChild(btn);
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 600 },
      ],
      initial: "full",
      animation: "tween",
      duration: 0,
      respectReducedMotion: false,
    });
    btn.focus();
    expect(document.activeElement).toBe(btn);
    const blurSpy = vi.spyOn(btn, "blur");

    dispatchPointer(handle, "pointerdown", { clientY: 100, pointerType: "touch" });
    dispatchPointer(handle, "pointermove", { clientY: 200, pointerType: "touch" });

    expect(blurSpy).not.toHaveBeenCalled();

    dispatchPointer(handle, "pointerup", { clientY: 200, pointerType: "touch" });
    blurSpy.mockRestore();
    engine.destroy();
  });
});
