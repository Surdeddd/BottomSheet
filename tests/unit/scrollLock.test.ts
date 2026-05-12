import { describe, expect, it, beforeEach } from "vitest";
import {
  lockBodyScroll,
  __resetScrollLockForTests,
} from "../../src/core/lifecycle/scrollLock";

describe("lockBodyScroll", () => {
  beforeEach(() => {
    __resetScrollLockForTests();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  });

  it("locks body scroll when first lock is acquired", () => {
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    release();
    expect(document.body.style.overflow).toBe("");
  });

  it("ref-counts so nested locks don't break early", () => {
    const release1 = lockBodyScroll();
    const release2 = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    release1();
    expect(document.body.style.overflow).toBe("hidden");
    release2();
    expect(document.body.style.overflow).toBe("");
  });

  it("is idempotent on double release", () => {
    const release = lockBodyScroll();
    release();
    release();
    expect(document.body.style.overflow).toBe("");
  });

  it("preserves scroll position", () => {
    Object.defineProperty(window, "scrollY", { value: 250, configurable: true, writable: true });
    const release = lockBodyScroll();
    expect(document.body.style.top).toBe("-250px");
    release();
  });
});
