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
  // checkVisibility is supported in all evergreens (Chrome 105+, Safari 17.4+,
  // Firefox 125+) and avoids the position:fixed false-negative of offsetParent.
  if (typeof el.checkVisibility === "function") {
    return el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  }
  return el.offsetParent !== null;
};

const focusables = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    el =>
      !el.hasAttribute("inert") &&
      isVisible(el) &&
      !el.matches("[aria-hidden='true']"),
  );

/**
 * Trap Tab focus inside `container`. Calls `onEscape` when Esc is pressed
 * (caller decides whether to close the sheet). Returns a teardown function
 * that releases the trap and restores focus to the previously-active element.
 *
 * SSR-safe: if `document` is unavailable, returns a no-op teardown.
 */
export const installFocusTrap = (
  container: HTMLElement,
  options: {
    initialFocus?: HTMLElement | string;
    onEscape?: () => void;
  } = {},
): (() => void) => {
  if (typeof document === "undefined") return () => {};
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const focusInitial = () => {
    const initial =
      typeof options.initialFocus === "string"
        ? container.querySelector<HTMLElement>(options.initialFocus)
        : options.initialFocus ?? focusables(container)[0] ?? container;
    initial?.focus({ preventScroll: true });
  };
  focusInitial();

  const handleKey = (e: KeyboardEvent) => {
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
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Catch focus that escapes via clicks / programmatic moves.
  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as Node | null;
    if (target && !container.contains(target)) {
      const list = focusables(container);
      list[0]?.focus({ preventScroll: true });
    }
  };

  document.addEventListener("keydown", handleKey, true);
  document.addEventListener("focusin", handleFocusIn, true);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    document.removeEventListener("keydown", handleKey, true);
    document.removeEventListener("focusin", handleFocusIn, true);
    // If the originator was removed from the DOM while the trap was active,
    // .focus() silently no-ops and the user is left on <body>. Fall back to
    // a documented anchor or the document root for a saner orientation.
    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus({ preventScroll: true });
    } else {
      const fallback =
        document.querySelector<HTMLElement>("[data-bs-restore-fallback]");
      fallback?.focus({ preventScroll: true });
    }
  };
};
