import type { ScrimOverlayPosition, SheetMode } from "../types";

export type SheetAnchoredStyle = {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
};

export function resolveSheetAnchoredStyle(
  mode: SheetMode,
  position: "sheet-top-left" | "sheet-top-center" | "sheet-top-right",
  inset: string,
): SheetAnchoredStyle {
  const sizeOffset = `calc(var(--bs-size, 0px) + ${inset})`;
  switch (mode) {
    case "bottom":
      if (position === "sheet-top-left") return { bottom: sizeOffset, left: inset };
      if (position === "sheet-top-right") return { bottom: sizeOffset, right: inset };
      return { bottom: sizeOffset, left: "50%", transform: "translateX(-50%)" };
    case "top":
      if (position === "sheet-top-left") return { top: sizeOffset, left: inset };
      if (position === "sheet-top-right") return { top: sizeOffset, right: inset };
      return { top: sizeOffset, left: "50%", transform: "translateX(-50%)" };
    case "left":
      if (position === "sheet-top-left") return { left: sizeOffset, top: inset };
      if (position === "sheet-top-right") return { left: sizeOffset, bottom: inset };
      return { left: sizeOffset, top: "50%", transform: "translateY(-50%)" };
    case "right":
      if (position === "sheet-top-left") return { right: sizeOffset, top: inset };
      if (position === "sheet-top-right") return { right: sizeOffset, bottom: inset };
      return { right: sizeOffset, top: "50%", transform: "translateY(-50%)" };
  }
}

export function applyOverlayPosition(
  ws: CSSStyleDeclaration,
  mode: SheetMode,
  position: ScrimOverlayPosition,
  inset: string,
): void {
  switch (position) {
    case "top-left":
      ws.top = inset;
      ws.left = inset;
      break;
    case "top-center":
      ws.top = inset;
      ws.left = "50%";
      ws.transform = "translateX(-50%)";
      break;
    case "top-right":
      ws.top = inset;
      ws.right = inset;
      break;
    case "center-left":
      ws.top = "50%";
      ws.left = inset;
      ws.transform = "translateY(-50%)";
      break;
    case "center":
      ws.top = "50%";
      ws.left = "50%";
      ws.transform = "translate(-50%, -50%)";
      break;
    case "center-right":
      ws.top = "50%";
      ws.right = inset;
      ws.transform = "translateY(-50%)";
      break;
    case "bottom-left":
      ws.bottom = inset;
      ws.left = inset;
      break;
    case "bottom-center":
      ws.bottom = inset;
      ws.left = "50%";
      ws.transform = "translateX(-50%)";
      break;
    case "bottom-right":
      ws.bottom = inset;
      ws.right = inset;
      break;
    case "sheet-top-left":
    case "sheet-top-center":
    case "sheet-top-right": {
      const style = resolveSheetAnchoredStyle(mode, position, inset);
      if (style.top !== undefined) ws.top = style.top;
      if (style.bottom !== undefined) ws.bottom = style.bottom;
      if (style.left !== undefined) ws.left = style.left;
      if (style.right !== undefined) ws.right = style.right;
      if (style.transform !== undefined) ws.transform = style.transform;
      break;
    }
  }
}
