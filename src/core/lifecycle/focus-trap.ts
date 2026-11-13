import { shared } from "../primitives/shared";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const isVisible = (el: HTMLElement): boolean => {
  if (typeof el.checkVisibility === "function") {
    return el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  }
  return el.offsetParent !== null;
};

const collectFocusables = (root: Element): HTMLElement[] => {
  const out = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (typeof HTMLSlotElement !== "undefined") {
    for (const slot of Array.from(root.querySelectorAll("slot"))) {
      for (const assigned of (slot as HTMLSlotElement).assignedElements()) {
        if (assigned.matches(FOCUSABLE)) out.push(assigned as HTMLElement);
        out.push(...collectFocusables(assigned));
      }
    }
  }
  return out;
};

const focusables = (root: HTMLElement): HTMLElement[] =>
  collectFocusables(root).filter(
    el =>
      !el.hasAttribute("inert") &&
      isVisible(el) &&
      !el.matches("[aria-hidden='true']"),
  );

const FOCUS_ALLOW_ATTR = "data-bs-focus-allow";

const composedParent = (node: Node): Node | null => {
  const slot = (node as Element).assignedSlot;
  if (slot) return slot;
  const parent = node.parentNode;
  return parent instanceof ShadowRoot ? parent.host : parent;
};

const containsComposed = (container: HTMLElement, node: Node | null): boolean => {
  for (let n = node; n; n = composedParent(n)) {
    if (n === container) return true;
  }
  return false;
};

const isAllowedOutside = (node: Node | null): boolean => {
  for (let n = node; n; n = composedParent(n)) {
    if (n instanceof Element && n.hasAttribute(FOCUS_ALLOW_ATTR)) return true;
  }
  return false;
};

const deepActiveElement = (): Element | null => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
};

const trapStack = shared("focusTraps", () => [] as object[]);

export const installFocusTrap = (
  container: HTMLElement,
  options: {
    initialFocus?: HTMLElement | string | false;
    onEscape?: () => void;
    isActive?: () => boolean;
  } = {},
): (() => void) => {
  if (typeof document === "undefined") return () => {};
  const token = {};
  if (!options.isActive) trapStack.push(token);
  const isActive =
    options.isActive ??
    ((): boolean => trapStack[trapStack.length - 1] === token);
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const focusInitial = () => {
    const spec = options.initialFocus;
    if (spec === false) {
      if (!container.hasAttribute("tabindex")) container.tabIndex = -1;
      container.focus({ preventScroll: true });
      return;
    }
    const initial =
      typeof spec === "string"
        ? container.querySelector<HTMLElement>(spec)
        : spec ?? focusables(container)[0] ?? container;
    initial?.focus({ preventScroll: true });
  };
  if (!containsComposed(container, deepActiveElement())) focusInitial();

  const handleKey = (e: KeyboardEvent) => {
    if (!isActive()) return;
    if (e.key === "Escape" && options.onEscape) {
      options.onEscape();
      return;
    }
    if (e.key !== "Tab") return;
    const list = focusables(container);
    if (list.length === 0) {
      e.preventDefault();
      return;
    }
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const active = deepActiveElement();
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleFocusIn = (e: FocusEvent) => {
    if (!isActive()) return;
    const target = (e.composedPath()[0] ?? e.target) as Node | null;
    if (!target || containsComposed(container, target)) return;
    if (isAllowedOutside(target)) return;
    focusables(container)[0]?.focus({ preventScroll: true });
  };

  document.addEventListener("keydown", handleKey, true);
  document.addEventListener("focusin", handleFocusIn, true);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const idx = trapStack.indexOf(token);
    if (idx !== -1) trapStack.splice(idx, 1);
    document.removeEventListener("keydown", handleKey, true);
    document.removeEventListener("focusin", handleFocusIn, true);
    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus({ preventScroll: true });
    } else {
      const fallback =
        document.querySelector<HTMLElement>("[data-bs-restore-fallback]");
      fallback?.focus({ preventScroll: true });
    }
  };
};
