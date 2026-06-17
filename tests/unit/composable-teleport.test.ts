import { describe, expect, it, beforeEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useBottomSheet } from "../../src/react/useBottomSheet";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Sheet(props: { teleportTo?: HTMLElement | string | null }) {
  const bs = useBottomSheet({
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "full", size: 400 },
    ],
    initial: "closed",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
    teleportTo: props.teleportTo,
    backdropColor: "rgb(1, 2, 3)",
  });
  return jsxs("div", {
    className: "bs-root",
    children: [
      jsx("div", { ref: bs.backdropRef, className: "bs-backdrop" }),
      jsx("div", { ref: bs.screenRef, className: "bs-screen" }),
      jsxs("section", {
        ref: bs.sheetRef,
        className: "bs-sheet",
        children: [
          jsx("div", { ref: bs.handleRef, className: "bs-handle" }),
          jsx("div", { ref: bs.contentRef, className: "bs-content" }),
        ],
      }),
    ],
  });
}

describe("React useBottomSheet — teleportTo", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("relocates backdrop/screen/sheet to the target on mount", async () => {
    await act(async () => {
      root.render(jsx(Sheet, { teleportTo: document.body }));
    });
    const sheet = document.querySelector(".bs-sheet")!;
    const backdrop = document.querySelector(".bs-backdrop")!;
    expect(sheet.parentElement).toBe(document.body);
    expect(backdrop.parentElement).toBe(document.body);
    // not left inside the (transform-prone) .bs-root in the consumer tree
    expect(sheet.closest(".bs-root")).toBeNull();
    await act(async () => {
      root.unmount();
    });
  });

  it("unmounts cleanly after teleport (no removeChild throw) and removes nodes", async () => {
    await act(async () => {
      root.render(jsx(Sheet, { teleportTo: "body" }));
    });
    expect(document.querySelector(".bs-sheet")).not.toBeNull();
    await act(async () => {
      root.unmount();
    });
    expect(document.querySelector(".bs-sheet")).toBeNull();
    expect(document.querySelector(".bs-backdrop")).toBeNull();
  });

  it("leaves elements in place when teleportTo is not set", async () => {
    await act(async () => {
      root.render(jsx(Sheet, {}));
    });
    const sheet = document.querySelector(".bs-sheet")!;
    expect(sheet.closest(".bs-root")).not.toBeNull();
    await act(async () => {
      root.unmount();
    });
  });
});
