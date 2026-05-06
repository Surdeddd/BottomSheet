/**
 * Mark every sibling of `root` (or body children when root is detached) as
 * `inert`. Used by both `BottomSheetEngine` (via LifecycleController) and
 * `OverlayEngine` to make the rest of the page non-interactive while a modal
 * is open. Tracks which elements WE marked so `remove()` doesn't strip
 * `inert` from siblings the consumer set themselves.
 *
 * @internal
 */
export type InertSiblingsHandle = {
  /** Mark all OTHER children of root's parent as inert. Idempotent. */
  apply: () => void;
  /** Remove inert from every element we marked, in insertion order. */
  remove: () => void;
};

export function createInertSiblings(
  rootProvider: () => HTMLElement,
): InertSiblingsHandle {
  const tracked: HTMLElement[] = [];
  return {
    apply() {
      if (typeof document === "undefined") return;
      const root = rootProvider();
      // Detached element falls back to body so the helper still works in
      // shadow-DOM/portal scenarios where root.parentElement is null.
      const parent = root.parentElement ?? document.body;
      for (const child of Array.from(parent.children)) {
        if (child === root) continue;
        // Skip elements the consumer pre-marked — preserves their intent
        // and prevents `remove()` from stealing their `inert`.
        if (child.hasAttribute("inert")) continue;
        child.setAttribute("inert", "");
        tracked.push(child as HTMLElement);
      }
    },
    remove() {
      for (const el of tracked) el.removeAttribute("inert");
      tracked.length = 0;
    },
  };
}
