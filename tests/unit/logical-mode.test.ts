import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import {
  resolveMode,
  readDirection,
  isLogicalMode,
} from "../../src/core/primitives/logical-mode";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";

const settle = () => new Promise(r => setTimeout(r, 30));

const mountSheet = (dir?: "ltr" | "rtl") => {
  const host = document.createElement("div");
  if (dir) host.setAttribute("dir", dir);
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  sheet.appendChild(handle);
  host.appendChild(sheet);
  document.body.appendChild(host);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { host, sheet, handle };
};

describe("logical modes", () => {
  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("dir");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("dir");
  });

  it("classifies logical and physical modes", () => {
    expect(isLogicalMode("start")).toBe(true);
    expect(isLogicalMode("end")).toBe(true);
    expect(isLogicalMode("left")).toBe(false);
    expect(isLogicalMode("bottom")).toBe(false);
  });

  it("leaves physical modes untouched regardless of direction", () => {
    const { sheet } = mountSheet("rtl");
    expect(resolveMode("left", sheet)).toBe("left");
    expect(resolveMode("right", sheet)).toBe("right");
    expect(resolveMode("bottom", sheet)).toBe("bottom");
    expect(resolveMode("top", sheet)).toBe("top");
  });

  it("maps start/end to the left/right pair under ltr", () => {
    const { sheet } = mountSheet("ltr");
    expect(resolveMode("start", sheet)).toBe("left");
    expect(resolveMode("end", sheet)).toBe("right");
  });

  it("mirrors start/end under rtl", () => {
    const { sheet } = mountSheet("rtl");
    expect(resolveMode("start", sheet)).toBe("right");
    expect(resolveMode("end", sheet)).toBe("left");
  });

  it("falls back to ltr when there is no element to read", () => {
    expect(readDirection(null)).toBe("ltr");
    expect(resolveMode("start", null)).toBe("left");
    expect(resolveMode("end", undefined)).toBe("right");
  });

  it("inherits direction from an ancestor, not just the sheet itself", () => {
    const { sheet, host } = mountSheet();
    host.setAttribute("dir", "rtl");
    expect(resolveMode("start", sheet)).toBe("right");
  });

  it("an engine built with mode:start drives the left edge under ltr", async () => {
    const { sheet, handle } = mountSheet("ltr");
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      mode: "start",
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 300 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 10,
    } as never);
    await settle();

    await engine.snapTo("open");
    await settle();

    expect(engine.state.activeId).toBe("open");
    expect(sheet.style.transform).toContain("translate3d");
    engine.destroy();
  });

  it("an engine built with mode:start drives the right edge under rtl", async () => {
    const { sheet, handle } = mountSheet("rtl");
    const engine = new BottomSheetEngine({
      element: sheet,
      handle,
      mode: "start",
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 300 },
      ],
      initial: "closed",
      animation: "tween",
      duration: 10,
    } as never);
    await settle();

    await engine.snapTo("open");
    await settle();

    expect(engine.state.activeId).toBe("open");
    expect(sheet.dataset.mode).not.toBe("start");
    engine.destroy();
  });
});
