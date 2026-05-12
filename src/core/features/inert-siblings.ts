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
      const root = rootProvider();
      const parent = root.parentElement ?? document.body;
      for (const child of Array.from(parent.children)) {
        if (child === root) continue;
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
