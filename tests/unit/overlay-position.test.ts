import { describe, expect, it } from "vitest";
import {
  applyOverlayPosition,
  resetOverlayPosition,
  resolveSheetAnchoredStyle,
} from "../../src/core/primitives/overlay-position";
import type {
  PhysicalSheetMode,
  ScrimOverlayPosition,
} from "../../src/core/types";

type Placed = {
  top: string;
  bottom: string;
  left: string;
  right: string;
  transform: string;
};

const place = (
  position: ScrimOverlayPosition,
  mode: PhysicalSheetMode = "bottom",
  inset = "16px",
): Placed => {
  const node = document.createElement("div");
  applyOverlayPosition(node.style, mode, position, inset);
  const { top, bottom, left, right, transform } = node.style;
  return { top, bottom, left, right, transform };
};

const EMPTY: Placed = { top: "", bottom: "", left: "", right: "", transform: "" };
const RIDE = "calc(var(--bs-size, 0px) + 16px)";

describe("overlay position", () => {
  const screen: Array<[ScrimOverlayPosition, Partial<Placed>]> = [
    ["top-left", { top: "16px", left: "16px" }],
    ["top-center", { top: "16px", left: "50%", transform: "translateX(-50%)" }],
    ["top-right", { top: "16px", right: "16px" }],
    ["center-left", { top: "50%", left: "16px", transform: "translateY(-50%)" }],
    ["center", { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }],
    ["center-right", { top: "50%", right: "16px", transform: "translateY(-50%)" }],
    ["bottom-left", { bottom: "16px", left: "16px" }],
    [
      "bottom-center",
      { bottom: "16px", left: "50%", transform: "translateX(-50%)" },
    ],
    ["bottom-right", { bottom: "16px", right: "16px" }],
  ];

  for (const [position, expected] of screen) {
    it(`${position} is fixed to the screen whatever the sheet's edge`, () => {
      for (const mode of ["bottom", "top", "left", "right"] as const) {
        expect(place(position, mode)).toEqual({ ...EMPTY, ...expected });
      }
    });
  }

  const riding: Array<
    [PhysicalSheetMode, ScrimOverlayPosition, Partial<Placed>]
  > = [
    ["bottom", "sheet-top-left", { bottom: RIDE, left: "16px" }],
    ["bottom", "sheet-top-right", { bottom: RIDE, right: "16px" }],
    [
      "bottom",
      "sheet-top-center",
      { bottom: RIDE, left: "50%", transform: "translateX(-50%)" },
    ],
    ["top", "sheet-top-left", { top: RIDE, left: "16px" }],
    ["top", "sheet-top-right", { top: RIDE, right: "16px" }],
    [
      "top",
      "sheet-top-center",
      { top: RIDE, left: "50%", transform: "translateX(-50%)" },
    ],
    ["left", "sheet-top-left", { left: RIDE, top: "16px" }],
    ["left", "sheet-top-right", { left: RIDE, bottom: "16px" }],
    [
      "left",
      "sheet-top-center",
      { left: RIDE, top: "50%", transform: "translateY(-50%)" },
    ],
    ["right", "sheet-top-left", { right: RIDE, top: "16px" }],
    ["right", "sheet-top-right", { right: RIDE, bottom: "16px" }],
    [
      "right",
      "sheet-top-center",
      { right: RIDE, top: "50%", transform: "translateY(-50%)" },
    ],
  ];

  for (const [mode, position, expected] of riding) {
    it(`${position} rides the ${mode} sheet's leading edge`, () => {
      expect(place(position, mode)).toEqual({ ...EMPTY, ...expected });
    });
  }

  it("carries the inset into the riding offset", () => {
    expect(
      resolveSheetAnchoredStyle("bottom", "sheet-top-right", "2rem"),
    ).toEqual({
      bottom: "calc(var(--bs-size, 0px) + 2rem)",
      right: "2rem",
    });
  });

  it("reset clears every side so a new position starts clean", () => {
    const node = document.createElement("div");
    applyOverlayPosition(node.style, "bottom", "center", "16px");
    resetOverlayPosition(node.style);
    applyOverlayPosition(node.style, "bottom", "bottom-right", "8px");
    const { top, bottom, left, right, transform } = node.style;
    expect({ top, bottom, left, right, transform }).toEqual({
      ...EMPTY,
      bottom: "8px",
      right: "8px",
    });
  });
});
