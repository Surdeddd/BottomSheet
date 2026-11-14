import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { installFitObserver } from "../../src/core/features/fit-observer";
import { teleportElements } from "../../src/core/features/teleport";
import { installGestures } from "../../src/core/gestures";
import {
  __resetSheetStackForTests,
} from "../../src/core/lifecycle/sheet-stack";
import {
  __resetScrollLockForTests,
  lockBodyScroll,
} from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

type Nodes = {
  root: HTMLElement;
  backdrop: HTMLElement;
  screen: HTMLElement;
  sheet: HTMLElement;
  handle: HTMLElement;
  header: HTMLElement;
  content: HTMLElement;
  footer: HTMLElement;
};

const buildSheet = (parent: HTMLElement = document.body): Nodes => {
  const root = document.createElement("div");
  root.className = "bs-root";
  const backdrop = document.createElement("div");
  backdrop.className = "bs-backdrop";
  const screen = document.createElement("div");
  screen.className = "bs-screen";
  const sheet = document.createElement("section");
  sheet.className = "bs-sheet";
  const handle = document.createElement("div");
  handle.className = "bs-handle";
  const header = document.createElement("div");
  header.className = "bs-header";
  const content = document.createElement("div");
  content.className = "bs-content";
  const footer = document.createElement("div");
  footer.className = "bs-footer";
  sheet.append(handle, header, content, footer);
  root.append(backdrop, screen, sheet);
  parent.appendChild(root);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { root, backdrop, screen, sheet, handle, header, content, footer };
};

const points = [
  { id: "closed", size: 0 },
  { id: "half", size: 320 },
  { id: "full", size: 600 },
];

const engineFor = (n: Nodes, extra: Record<string, unknown> = {}) =>
  new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    scrollContainer: n.content,
    backdrop: n.backdrop,
    scrim: n.screen,
    snapPoints: points,
    initial: "half",
    animation: "tween",
    duration: 0,
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
  Object.defineProperty(window, "innerWidth", {
    value: 800,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fit observer", () => {
  it("watches the header and footer, not only the scroll container", async () => {
    const observed = new Set<Element>();
    class FakeResizeObserver {
      observe(el: Element): void {
        observed.add(el);
      }
      unobserve(el: Element): void {
        observed.delete(el);
      }
      disconnect(): void {
        observed.clear();
      }
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const n = buildSheet();
    const row = document.createElement("p");
    n.content.appendChild(row);
    const detach = installFitObserver({
      element: n.sheet,
      handle: n.handle,
      scrollContainer: n.content,
      hasFitSnap: () => true,
      isDestroyed: () => false,
      isDragging: () => false,
      recompute: () => {},
    });
    expect(observed.has(n.header)).toBe(true);
    expect(observed.has(n.footer)).toBe(true);
    expect(observed.has(n.handle)).toBe(true);
    expect(observed.has(row)).toBe(true);
    expect(observed.has(n.content)).toBe(false);

    const banner = document.createElement("div");
    n.sheet.insertBefore(banner, n.content);
    await wait(20);
    expect(observed.has(banner)).toBe(true);
    detach();
  });
});

describe("engine-level teleport", () => {
  it("keeps teleported nodes under a styled root in the target", () => {
    const app = document.createElement("div");
    app.id = "app";
    document.body.appendChild(app);
    const n = buildSheet(app);
    n.root.classList.add("bs-theme-ios");
    n.root.style.setProperty("--bs-radius", "28px");

    const restore = teleportElements(
      [n.backdrop, n.screen, n.sheet],
      document.body,
    );
    const wrapper = n.sheet.closest<HTMLElement>(".bs-root")!;
    expect(wrapper).not.toBe(n.root);
    expect(wrapper.parentElement).toBe(document.body);
    expect(wrapper.hasAttribute("data-bs-teleported")).toBe(true);
    expect(wrapper.classList.contains("bs-theme-ios")).toBe(true);
    expect(wrapper.style.getPropertyValue("--bs-radius")).toBe("28px");
    expect(n.backdrop.parentElement).toBe(wrapper);
    expect(n.screen.parentElement).toBe(wrapper);

    restore();
    expect(n.sheet.parentElement).toBe(n.root);
    expect(wrapper.isConnected).toBe(false);
  });

  it("follows a theme class changed on the original root", async () => {
    const n = buildSheet();
    const restore = teleportElements([n.sheet], document.body);
    const wrapper = n.sheet.closest<HTMLElement>(".bs-root")!;
    n.root.classList.add("bs-theme-material");
    await wait(20);
    expect(wrapper.classList.contains("bs-theme-material")).toBe(true);
    restore();
  });

  it("feeds the size to the root the sheet left as well as the one it moved to", async () => {
    const n = buildSheet();
    const restore = teleportElements(
      [n.backdrop, n.screen, n.sheet],
      document.body,
    );
    const wrapper = n.sheet.closest<HTMLElement>(".bs-root")!;
    const engine = engineFor(n);
    await engine.snapTo("full");
    expect(wrapper.style.getPropertyValue("--bs-size")).toBe("600px");
    expect(n.root.style.getPropertyValue("--bs-size")).toBe("600px");
    engine.destroy();
    restore();
  });
});

describe("inert siblings", () => {
  const page = () => {
    const app = document.createElement("div");
    app.id = "app";
    const nav = document.createElement("nav");
    const main = document.createElement("main");
    const article = document.createElement("article");
    main.appendChild(article);
    app.append(nav, main);
    const aside = document.createElement("aside");
    document.body.append(app, aside);
    return { app, nav, main, article, aside };
  };

  it("makes the rest of the app inert when the sheet lives inside the app root", async () => {
    const p = page();
    const n = buildSheet(p.main);
    const engine = engineFor(n, { inertSiblings: true });
    expect(p.aside.hasAttribute("inert")).toBe(true);
    expect(p.nav.hasAttribute("inert")).toBe(true);
    expect(p.article.hasAttribute("inert")).toBe(true);
    expect(p.app.hasAttribute("inert")).toBe(false);
    expect(p.main.hasAttribute("inert")).toBe(false);
    expect(n.root.hasAttribute("inert")).toBe(false);

    await engine.close();
    expect(p.aside.hasAttribute("inert")).toBe(false);
    expect(p.nav.hasAttribute("inert")).toBe(false);
    expect(p.article.hasAttribute("inert")).toBe(false);
    engine.destroy();
  });

  it("hands the inert set to the sheet on top and back again", async () => {
    const p = page();
    const lowerNodes = buildSheet(p.main);
    const upperHost = document.createElement("section");
    p.app.appendChild(upperHost);
    const upperNodes = buildSheet(upperHost);
    const lower = engineFor(lowerNodes, { inertSiblings: true });
    const upper = engineFor(upperNodes, {
      inertSiblings: true,
      initial: "closed",
    });
    expect(upperHost.hasAttribute("inert")).toBe(true);

    await upper.open("half");
    expect(upperHost.hasAttribute("inert")).toBe(false);
    expect(p.main.hasAttribute("inert")).toBe(true);

    await upper.close();
    expect(p.main.hasAttribute("inert")).toBe(false);
    expect(upperHost.hasAttribute("inert")).toBe(true);
    lower.destroy();
    upper.destroy();
  });
});

describe("scroll lock release", () => {
  it("puts the page back without a smooth scroll", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    Object.defineProperty(window, "scrollY", { value: 1200, configurable: true });
    Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
    const release = lockBodyScroll();
    release();
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1200,
      left: 0,
      behavior: "instant",
    });
  });
});

describe("setMode leftovers", () => {
  it("moves the size from height to width when the axis changes at an equal extent", () => {
    const n = buildSheet();
    const engine = engineFor(n, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "open", size: 320 },
      ],
      initial: "open",
    });
    expect(n.sheet.style.height).toBe("320px");
    engine.setMode("left");
    expect(n.sheet.style.height).toBe("");
    expect(n.sheet.style.width).toBe("320px");
    engine.destroy();
  });

  it("re-applies the above-sheet scrim inset for the new edge", () => {
    const n = buildSheet();
    const engine = engineFor(n, { scrimMode: "above-sheet" });
    expect(n.screen.style.inset).toBe(
      "0 0 calc(var(--bs-size) + var(--bs-keyboard-inset, 0px)) 0",
    );
    engine.setMode("right");
    expect(n.screen.style.inset).toBe("0 var(--bs-size) 0 0");
    engine.destroy();
  });

  it("re-anchors anchored elements to the new edge", () => {
    const n = buildSheet();
    const engine = engineFor(n);
    const chip = document.createElement("button");
    engine.addAnchor({ element: chip, position: "sheet-top-right" });
    const wrapper = chip.parentElement!;
    expect(wrapper.style.bottom).toContain("--bs-size");
    engine.setMode("top");
    expect(wrapper.style.bottom).toBe("");
    expect(wrapper.style.top).toContain("--bs-size");
    engine.destroy();
  });
});

describe("stack-aware layers", () => {
  it("publishes the sheet's z-index on its root so the scrim follows the stack", async () => {
    const a = buildSheet();
    const b = buildSheet();
    const lower = engineFor(a);
    const upper = engineFor(b, { initial: "closed" });
    await upper.open("half");
    expect(b.root.style.getPropertyValue("--bs-z-sheet")).toBe(
      b.sheet.style.zIndex,
    );
    expect(a.root.style.getPropertyValue("--bs-z-sheet")).toBe(
      a.sheet.style.zIndex,
    );
    expect(Number(b.sheet.style.zIndex)).toBeGreaterThan(
      Number(a.sheet.style.zIndex),
    );
    lower.destroy();
    upper.destroy();
  });
});

describe("small ones", () => {
  it("labels the dialog from a heading in the header", () => {
    const n = buildSheet();
    const title = document.createElement("h2");
    title.textContent = "Filters";
    n.header.appendChild(title);
    const engine = engineFor(n, { focusTrap: true });
    expect(title.id).not.toBe("");
    expect(n.sheet.getAttribute("aria-labelledby")).toBe(title.id);
    engine.destroy();
  });

  it("ends a gesture as a cancel when pointer capture is lost", () => {
    const handle = document.createElement("div");
    document.body.appendChild(handle);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    const detach = installGestures(handle, "bottom", {
      onStart,
      onMove: () => {},
      onEnd,
      onCancel,
    });
    const fire = (type: string, clientY: number): void => {
      handle.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: "touch",
          bubbles: true,
          clientY,
        } as PointerEventInit),
      );
    };
    fire("pointerdown", 500);
    fire("pointermove", 480);
    fire("lostpointercapture", 480);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();

    fire("pointerdown", 500);
    expect(onStart).toHaveBeenCalledTimes(2);
    detach();
  });

  it("keeps the gesture when a child gives its implicit capture up to the handle", () => {
    const handle = document.createElement("div");
    const row = document.createElement("div");
    handle.appendChild(row);
    document.body.appendChild(handle);
    Object.assign(handle, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    const onCancel = vi.fn();
    const onMove = vi.fn();
    const detach = installGestures(handle, "bottom", {
      onStart: () => {},
      onMove,
      onEnd: () => {},
      onCancel,
    });
    const fire = (target: HTMLElement, type: string, clientY: number): void => {
      target.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 9,
          pointerType: "touch",
          bubbles: true,
          clientY,
        } as PointerEventInit),
      );
    };
    fire(row, "pointerdown", 500);
    fire(row, "lostpointercapture", 500);
    fire(handle, "pointermove", 470);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onMove).toHaveBeenCalledTimes(1);
    detach();
  });

  it("warns about a snap size the browser rejects", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const n = buildSheet();
    const engine = engineFor(n, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "odd", size: "12 parsecs" },
        { id: "half", size: 320 },
      ],
    });
    expect(
      warn.mock.calls.some(call => String(call[0]).includes("12 parsecs")),
    ).toBe(true);
    engine.destroy();
  });
});
