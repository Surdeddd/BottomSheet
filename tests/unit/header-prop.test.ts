import { describe, expect, it, beforeEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { jsx } from "react/jsx-runtime";
import { createRef } from "react";
import {
  BottomSheet,
  type BottomSheetHandle,
} from "../../src/react/BottomSheet";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const flushAsync = async (steps = 4) => {
  for (let i = 0; i < steps; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await act(async () => {
      await Promise.resolve();
      await new Promise(r => setTimeout(r, 50));
    });
  }
};

describe("React: per-snap header function", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("renders a static header node in .bs-header, separate from the grabber", async () => {
    await act(async () => {
      root.render(
        jsx(BottomSheet, {
          snapPoints: [
            { id: "min", size: 100 },
            { id: "full", size: 800 },
          ],
          initial: "min",
          animation: "tween",
          duration: 0,
          respectReducedMotion: false,
          header: jsx("h2", { children: "Static Title" }),
        }),
      );
    });
    const handle = container.querySelector(".bs-handle");
    const headerRegion = container.querySelector(".bs-header");
    expect(headerRegion?.textContent).toBe("Static Title");
    expect(handle?.textContent).toBe("");
    expect(headerRegion?.closest(".bs-handle")).toBeNull();
  });

  it("renders a footer node in .bs-footer, after the scroll content", async () => {
    await act(async () => {
      root.render(
        jsx(BottomSheet, {
          snapPoints: [
            { id: "min", size: 100 },
            { id: "full", size: 800 },
          ],
          initial: "min",
          animation: "tween",
          duration: 0,
          respectReducedMotion: false,
          footer: jsx("button", { children: "Confirm" }),
        }),
      );
    });
    const sheet = container.querySelector(".bs-sheet")!;
    const footer = sheet.querySelector(".bs-footer");
    const content = sheet.querySelector(".bs-content")!;
    expect(footer?.textContent).toBe("Confirm");
    expect(footer?.closest(".bs-content")).toBeNull();
    // footer comes after content in DOM order
    expect(
      content.compareDocumentPosition(footer!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("calls the header function with engine state and re-renders on snap", async () => {
    const ref = createRef<BottomSheetHandle>();
    await act(async () => {
      root.render(
        jsx(BottomSheet, {
          ref,
          snapPoints: [
            { id: "min", size: 100 },
            { id: "full", size: 800 },
          ],
          initial: "min",
          animation: "tween",
          duration: 0,
          respectReducedMotion: false,
          header: (state: { activeId: string }) =>
            jsx("span", {
              "data-testid": "header",
              children: `header:${state.activeId}`,
            }),
        }),
      );
    });

    const headerEl = () => container.querySelector('[data-testid="header"]');
    expect(headerEl()?.textContent).toBe("header:min");

    await act(async () => {
      await ref.current?.snapTo("full");
    });
    await flushAsync();

    expect(headerEl()?.textContent).toBe("header:full");
  });
});
