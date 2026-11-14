import { describe, expect, it, beforeEach, vi } from "vitest";
import { installFocusTrap } from "../../src/core/lifecycle/focus-trap";

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

  it("finds initialFocus among slotted content of a shadow root", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const sheet = document.createElement("section");
    sheet.appendChild(document.createElement("slot"));
    shadow.appendChild(sheet);
    const wrapper = document.createElement("form");
    const field = document.createElement("input");
    field.id = "slotted";
    wrapper.appendChild(field);
    host.appendChild(wrapper);

    const release = installFocusTrap(sheet, { initialFocus: "#slotted" });
    expect(document.activeElement).toBe(field);
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

  it("brings focus that escaped forwards back to the first element", () => {
    const release = installFocusTrap(container);
    (container.querySelector("#second") as HTMLElement).focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    outsideButton.focus();
    expect((document.activeElement as HTMLElement).id).toBe("first");
    release();
  });

  it("brings focus that escaped backwards back to the last element", () => {
    const release = installFocusTrap(container);
    (container.querySelector("#second") as HTMLElement).focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
      }),
    );
    outsideButton.focus();
    expect((document.activeElement as HTMLElement).id).toBe("third");
    release();
  });

  it("forgets the direction once the Tab press is over", async () => {
    const release = installFocusTrap(container);
    (container.querySelector("#second") as HTMLElement).focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
      }),
    );
    await new Promise(resolve => setTimeout(resolve, 20));
    outsideButton.focus();
    expect((document.activeElement as HTMLElement).id).toBe("first");
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
