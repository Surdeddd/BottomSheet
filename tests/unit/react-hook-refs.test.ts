import { beforeEach, describe, expect, it } from "vitest";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  useBottomSheet,
  type UseBottomSheetReturn,
} from "../../src/react/useBottomSheet";
import { useOverlay, type UseOverlayReturn } from "../../src/react/useOverlay";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Assert<T extends true> = T;
type RefOf<Tag extends "div" | "section" | "button" | "aside"> = NonNullable<
  ComponentProps<Tag>["ref"]
>;
type Fits<R, Tag extends "div" | "section" | "button" | "aside"> =
  R extends RefOf<Tag> ? true : false;

type Sheet = UseBottomSheetReturn;
type Panel = UseOverlayReturn;

export type RefsFitAnyElement = [
  Assert<Fits<Sheet["sheetRef"], "section">>,
  Assert<Fits<Sheet["sheetRef"], "div">>,
  Assert<Fits<Sheet["handleRef"], "div">>,
  Assert<Fits<Sheet["handleRef"], "button">>,
  Assert<Fits<Sheet["contentRef"], "div">>,
  Assert<Fits<Sheet["backdropRef"], "div">>,
  Assert<Fits<Sheet["screenRef"], "div">>,
  Assert<Fits<Panel["panelRef"], "aside">>,
  Assert<Fits<Panel["backdropRef"], "div">>,
];

describe("refs returned by the React hooks", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("hold the elements they were given and start the engine", async () => {
    let seen: UseBottomSheetReturn<"closed" | "full"> | null = null;
    const Sheet = () => {
      const bs = useBottomSheet({
        snapPoints: [
          { id: "closed", size: 0 },
          { id: "full", size: 400 },
        ],
        initial: "full",
        animation: "tween",
        duration: 0,
      });
      seen = bs;
      return jsxs("div", {
        className: "bs-root",
        children: [
          jsx("div", { ref: bs.backdropRef, className: "bs-backdrop" }),
          jsxs("section", {
            ref: bs.sheetRef,
            className: "bs-sheet",
            children: [
              jsx("button", { ref: bs.handleRef, className: "bs-handle" }),
              jsx("div", { ref: bs.contentRef, className: "bs-content" }),
            ],
          }),
        ],
      });
    };
    await act(async () => {
      root.render(jsx(Sheet, {}));
    });
    const bs = seen as unknown as UseBottomSheetReturn<"closed" | "full">;
    expect(bs.sheetRef.current).toBe(container.querySelector(".bs-sheet"));
    expect(bs.handleRef.current).toBe(container.querySelector(".bs-handle"));
    expect(bs.contentRef.current).toBe(container.querySelector(".bs-content"));
    expect(bs.backdropRef.current).toBe(container.querySelector(".bs-backdrop"));
    expect(bs.screenRef.current).toBeNull();
    expect(bs.getEngine()?.state.activeId).toBe("full");

    await act(async () => root.unmount());
    expect(bs.sheetRef.current).toBeNull();
  });

  it("do the same for the overlay", async () => {
    let seen: UseOverlayReturn | null = null;
    const Panel = () => {
      const overlay = useOverlay({ edge: "right" });
      seen = overlay;
      return jsxs("div", {
        className: "ovl-root",
        children: [
          jsx("div", { ref: overlay.backdropRef, className: "ovl-backdrop" }),
          jsx("aside", { ref: overlay.panelRef, className: "ovl-panel" }),
        ],
      });
    };
    await act(async () => {
      root.render(jsx(Panel, {}));
    });
    const overlay = seen as unknown as UseOverlayReturn;
    expect(overlay.panelRef.current).toBe(container.querySelector(".ovl-panel"));
    expect(overlay.backdropRef.current).toBe(
      container.querySelector(".ovl-backdrop"),
    );
    expect(overlay.getEngine()).not.toBeNull();
    await act(async () => root.unmount());
  });
});
