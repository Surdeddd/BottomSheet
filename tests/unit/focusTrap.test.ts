import { describe, expect, it, beforeEach, vi } from "vitest";
import { installFocusTrap } from "../../src/core/lifecycle/focusTrap";

const buildContainer = (): HTMLElement => {
  const container = document.createElement("div");
  const first = document.createElement("button");
  first.id = "first";
  first.textContent = "first";
  const second = document.createElement("input");
  second.id = "second";
  const third = document.createElement("button");
  third.id = "third";
  third.textContent = "third";
  container.appendChild(first);
  container.appendChild(second);
  container.appendChild(third);
  return container;
};

describe("installFocusTrap", () => {
  let container: HTMLElement;
  let outsideButton: HTMLButtonElement;

  beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    outsideButton = document.createElement("button");
    outsideButton.textContent = "outside";
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    container = buildContainer();
    document.body.appendChild(container);
  });

  it("focuses first focusable on install", () => {
    const release = installFocusTrap(container);
    expect(document.activeElement).toBe(container.querySelector("#first"));
    release();
  });

  it("focuses initialFocus selector when provided", () => {
    const release = installFocusTrap(container, { initialFocus: "#second" });
    expect((document.activeElement as HTMLElement).id).toBe("second");
    release();
  });

  it("calls onEscape on Escape key", () => {
    let escaped = false;
    const release = installFocusTrap(container, {
      onEscape: () => (escaped = true),
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(escaped).toBe(true);
    release();
  });

  it("returns a function (no-op safe)", () => {
    const release = installFocusTrap(container);
    expect(typeof release).toBe("function");
    release();
  });

  it("is idempotent: double release does not refocus twice", () => {
    const focusSpy = vi.spyOn(outsideButton, "focus");
    const release = installFocusTrap(container);
    release();
    release();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});
