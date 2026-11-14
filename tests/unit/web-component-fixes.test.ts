import { describe, expect, it, beforeEach, vi } from "vitest";
import "../../src/web-component/index";
import type { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";

type SheetElement = HTMLElement & {
  getEngine: () => BottomSheetEngine | null;
};

const POINTS = JSON.stringify([
  { id: "closed", size: 0 },
  { id: "half", size: 300 },
  { id: "full", size: 600 },
]);

const create = (attrs: Record<string, string>): SheetElement => {
  const el = document.createElement("bottom-sheet") as SheetElement;
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  return el;
};

const inShadow = (el: SheetElement, selector: string): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>(selector)!;

beforeEach(() => {
  __resetSheetStackForTests();
  __resetScrollLockForTests();
  __resetCssLengthProbeForTests();
  __resetRouteCoordinatorForTests();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  document.body.removeAttribute("style");
  Object.defineProperty(window, "innerHeight", {
    value: 1000,
    configurable: true,
  });
});

describe("<bottom-sheet> attributes", () => {
  it("starts on the snap named by the snap attribute", () => {
    const el = create({ "snap-points": POINTS, initial: "closed", snap: "half" });
    document.body.appendChild(el);
    expect(el.getEngine()!.state.activeId).toBe("half");
    expect(el.getEngine()!.state.size).toBe(300);
  });

  it("keeps its engine when an attribute is set to the value it already has", () => {
    const el = create({
      "snap-points": POINTS,
      initial: "half",
      animation: "tween",
    });
    document.body.appendChild(el);
    const engine = el.getEngine();
    el.setAttribute("animation", "tween");
    el.setAttribute("snap-points", POINTS);
    expect(el.getEngine()).toBe(engine);
  });

  it("falls back to a usable sheet when the snap-points shorthand is malformed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = create({ "snap-points": "min,half:45%" });
    expect(() => document.body.appendChild(el)).not.toThrow();
    expect(el.getEngine()).not.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("accepts the logical modes start and end", () => {
    const el = create({ "snap-points": POINTS, initial: "half", mode: "end" });
    document.body.appendChild(el);
    expect(inShadow(el, ".bs-sheet").dataset.mode).toBe("right");
    el.setAttribute("mode", "start");
    expect(inShadow(el, ".bs-sheet").dataset.mode).toBe("left");
  });

  it("moves the button slots along with a live mode change", () => {
    const el = create({ "snap-points": POINTS, initial: "half" });
    document.body.appendChild(el);
    el.setAttribute("mode", "left");
    const slots = el.shadowRoot!.querySelectorAll<HTMLElement>(
      ".bs-button-slot",
    );
    expect(Array.from(slots).map(s => s.dataset.mode)).toEqual([
      "left",
      "left",
    ]);
  });
});

describe("<bottom-sheet> declarative anchors", () => {
  it("leaves a slotted anchor in the light DOM so page styles still reach it", () => {
    const el = create({ "snap-points": POINTS, initial: "half" });
    const anchor = document.createElement("button");
    anchor.slot = "anchor";
    anchor.className = "page-styled";
    el.appendChild(anchor);
    document.body.appendChild(el);

    expect(anchor.parentElement).toBe(el);
    expect(anchor.getRootNode()).toBe(document);
    const slotName = anchor.getAttribute("slot")!;
    const projected = el.shadowRoot!.querySelector<HTMLSlotElement>(
      `.bs-anchor slot[name="${slotName}"]`,
    );
    expect(projected).not.toBeNull();
  });

  it("gives the anchor its original slot name back when the sheet is removed", () => {
    const el = create({ "snap-points": POINTS, initial: "half" });
    const anchor = document.createElement("button");
    anchor.slot = "anchor";
    el.appendChild(anchor);
    document.body.appendChild(el);
    el.remove();
    expect(anchor.getAttribute("slot")).toBe("anchor");
    expect(anchor.parentElement).toBe(el);
  });
});
