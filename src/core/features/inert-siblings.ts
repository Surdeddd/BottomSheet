export type InertSiblingsHandle = {
  apply: () => void;
  remove: () => void;
};

const OWN_ROOTS = ".bs-root, .ovl-root";
const LAYER_CLASSES = [
  "bs-backdrop",
  "bs-screen",
  "bs-root",
  "ovl-backdrop",
  "ovl-root",
];

const isLayer = (el: Element): boolean =>
  LAYER_CLASSES.some(name => el.classList.contains(name));

export function createInertSiblings(
  rootProvider: () => HTMLElement,
): InertSiblingsHandle {
  const tracked: HTMLElement[] = [];
  const remove = (): void => {
    for (const el of tracked) el.removeAttribute("inert");
    tracked.length = 0;
  };
  return {
    apply() {
      if (typeof document === "undefined") return;
      remove();
      const surface = rootProvider();
      let node: HTMLElement | null =
        surface.closest<HTMLElement>(OWN_ROOTS) ?? surface;
      while (node && node !== document.body) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) {
          const root = node.getRootNode();
          node =
            typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot
              ? (root.host as HTMLElement)
              : null;
          continue;
        }
        for (const sibling of Array.from(parent.children)) {
          if (sibling === node) continue;
          if (sibling.hasAttribute("inert") || isLayer(sibling)) continue;
          sibling.setAttribute("inert", "");
          tracked.push(sibling as HTMLElement);
        }
        node = parent;
      }
    },
    remove,
  };
}
