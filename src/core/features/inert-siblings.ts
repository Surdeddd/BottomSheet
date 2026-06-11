export type InertSiblingsHandle = {
  apply: () => void;
  remove: () => void;
};

export function createInertSiblings(
  rootProvider: () => HTMLElement,
): InertSiblingsHandle {
  const tracked: HTMLElement[] = [];
  return {
    apply() {
      if (typeof document === "undefined") return;
      let top = rootProvider();
      while (top.parentElement && top.parentElement !== document.body) {
        top = top.parentElement;
      }
      const parent = top.parentElement ?? document.body;
      for (const child of Array.from(parent.children)) {
        if (child === top) continue;
        if (child.hasAttribute("inert")) continue;
        if (
          child.classList.contains("bs-backdrop") ||
          child.classList.contains("bs-screen") ||
          child.classList.contains("bs-root")
        ) {
          continue;
        }
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
