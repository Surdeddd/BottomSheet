import { describe, expect, it, beforeEach } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { installFocusTrap } from "../../src/core/lifecycle/focus-trap";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const linear = (t: number): number => t;

type SheetNodes = {
  sheet: HTMLElement;
  handle: HTMLElement;
  first: HTMLButtonElement;
  field: HTMLInputElement;
};

const makeSheet = (name: string): SheetNodes => {
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  const first = document.createElement("button");
  first.textContent = `${name} first`;
  const field = document.createElement("input");
  field.name = `${name}-field`;
  sheet.appendChild(handle);
  sheet.appendChild(first);
  sheet.appendChild(field);
  document.body.appendChild(sheet);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { sheet, handle, first, field };
};

const build = (nodes: SheetNodes, extra: Record<string, unknown> = {}) =>
  new BottomSheetEngine({
    element: nodes.sheet,
    handle: nodes.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: 300 },
      { id: "full", size: 800 },
    ],
    initial: "closed",
    animation: "tween",
    duration: 0,
    easing: linear,
    focusTrap: true,
    respectReducedMotion: false,
    ...extra,
  });

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

describe("focus in a stack of sheets", () => {
  it("lets the upper sheet keep focus when the lower one lands after it", async () => {
    const a = makeSheet("a");
    const b = makeSheet("b");
    const lower = build(a, { duration: 300 });
    const upper = build(b);
    void lower.open("full");
    await wait(40);
    await upper.open("full");
    await wait(500);
    b.field.focus();
    expect(document.activeElement).toBe(b.field);
    lower.destroy();
    upper.destroy();
  });

  it("lets an upper sheet without a trap keep focus over a trapped one", async () => {
    const a = makeSheet("a");
    const b = makeSheet("b");
    const lower = build(a);
    const upper = build(b, { focusTrap: false });
    await lower.open("full");
    await upper.open("full");
    b.field.focus();
    expect(document.activeElement).toBe(b.field);
    lower.destroy();
    upper.destroy();
  });

  it("lets the upper sheet keep focus when the lower one is retargeted mid-open", async () => {
    const a = makeSheet("a");
    const b = makeSheet("b");
    const lower = build(a, { duration: 300 });
    const upper = build(b);
    void lower.open("full");
    await wait(40);
    await upper.open("full");
    void lower.snapTo("half");
    await wait(500);
    b.field.focus();
    expect(document.activeElement).toBe(b.field);
    lower.destroy();
    upper.destroy();
  });

  it("hands the trap back to the lower sheet once the upper one has closed", async () => {
    const a = makeSheet("a");
    const b = makeSheet("b");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    const lower = build(a);
    const upper = build(b);
    await lower.open("full");
    await upper.open("full");
    await upper.close();
    outside.focus();
    expect(a.sheet.contains(document.activeElement)).toBe(true);
    lower.destroy();
    upper.destroy();
  });
});

describe("focus inside one sheet", () => {
  it("keeps the focus the user chose while the sheet was opening", async () => {
    const a = makeSheet("a");
    const engine = build(a, { duration: 300 });
    const opening = engine.open("full");
    await wait(80);
    a.field.focus();
    await opening;
    await wait(40);
    expect(document.activeElement).toBe(a.field);
    engine.destroy();
  });

  it("does not move focus that is already inside when the trap installs", () => {
    const a = makeSheet("a");
    a.field.focus();
    const release = installFocusTrap(a.sheet);
    expect(document.activeElement).toBe(a.field);
    release();
  });

  it("leaves focus alone inside an element marked data-bs-focus-allow", async () => {
    const a = makeSheet("a");
    const popup = document.createElement("div");
    popup.setAttribute("data-bs-focus-allow", "");
    const option = document.createElement("button");
    popup.appendChild(option);
    document.body.appendChild(popup);
    const engine = build(a);
    await engine.open("full");
    option.focus();
    expect(document.activeElement).toBe(option);
    engine.destroy();
  });

  it("wraps Shift+Tab from the first element when the sheet lives in a shadow root", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    const first = document.createElement("button");
    const last = document.createElement("button");
    container.appendChild(first);
    container.appendChild(last);
    shadow.appendChild(container);
    const release = installFocusTrap(container);
    first.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    expect(shadow.activeElement).toBe(last);
    expect(event.defaultPrevented).toBe(true);
    release();
  });
});
