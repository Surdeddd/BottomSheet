import { beforeEach, describe, expect, it, vi } from "vitest";
import { initReveal } from "../../demo/lib/reveal";

type IOCallback = (
  entries: Array<Partial<IntersectionObserverEntry>>,
) => void;

let lastCb: IOCallback | null = null;
let observed: Element[];

class FakeIO {
  constructor(cb: IOCallback) {
    lastCb = cb;
  }
  observe(el: Element) {
    observed.push(el);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  document.body.innerHTML = "";
  lastCb = null;
  observed = [];
  vi.stubGlobal("IntersectionObserver", FakeIO);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

describe("initReveal", () => {
  it("marks elements with .reveal and observes them, stagger sets delay", () => {
    document.body.innerHTML = `<section data-reveal></section><section data-reveal="2"></section>`;
    initReveal(document);
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    expect(els[0]!.classList.contains("reveal")).toBe(true);
    expect(observed).toHaveLength(2);
    expect(els[1]!.style.getPropertyValue("--reveal-delay")).toBe("120ms");
  });

  it("adds .is-revealed on intersection", () => {
    document.body.innerHTML = `<section data-reveal></section>`;
    initReveal(document);
    const el = document.querySelector("[data-reveal]")!;
    lastCb?.([{ isIntersecting: true, target: el }]);
    expect(el.classList.contains("is-revealed")).toBe(true);
  });

  it("does not mark anything when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    document.body.innerHTML = `<section data-reveal></section>`;
    initReveal(document);
    expect(
      document.querySelector("[data-reveal]")!.classList.contains("reveal"),
    ).toBe(false);
  });

  it("failsafe reveals in-viewport elements a silent observer left behind", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<section data-reveal></section>`;
    const el = document.querySelector<HTMLElement>("[data-reveal]")!;
    el.getBoundingClientRect = () => ({ top: 10 }) as DOMRect;
    initReveal(document);
    expect(el.classList.contains("is-revealed")).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(el.classList.contains("is-revealed")).toBe(true);
    vi.useRealTimers();
  });

  it("failsafe leaves below-the-fold elements to the observer", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<section data-reveal></section>`;
    const el = document.querySelector<HTMLElement>("[data-reveal]")!;
    el.getBoundingClientRect = () =>
      ({ top: window.innerHeight + 500 }) as DOMRect;
    initReveal(document);
    vi.advanceTimersByTime(3000);
    expect(el.classList.contains("is-revealed")).toBe(false);
    vi.useRealTimers();
  });
});
