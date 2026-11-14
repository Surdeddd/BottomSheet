export type TeleportTarget = HTMLElement | string | null | undefined;

export const resolveTeleportTarget = (
  target: TeleportTarget,
): HTMLElement | null => {
  if (!target) return null;
  if (typeof target !== "string") return target;
  if (typeof document === "undefined") return null;
  if (target === "body") return document.body;
  return document.querySelector<HTMLElement>(target);
};

type Record = { el: HTMLElement; parent: Node | null; next: Node | null };

const ROOT_CLASS = "bs-root";
const homes = new WeakMap<Element, HTMLElement>();

export const homeRootOf = (root: Element | null): HTMLElement | null =>
  (root && homes.get(root)) ?? null;

const mirrorClasses = (home: HTMLElement | null, wrapper: HTMLElement): void => {
  wrapper.className = home?.className ?? "";
  wrapper.classList.add(ROOT_CLASS);
};

export const teleportElements = (
  els: ReadonlyArray<HTMLElement | null | undefined>,
  target: HTMLElement,
): (() => void) => {
  const nodes = els.filter(
    (el): el is HTMLElement => !!el && el.parentNode !== target,
  );
  if (nodes.length === 0) return () => {};
  const home = nodes[0]!.closest<HTMLElement>(`.${ROOT_CLASS}`);
  if (home && home.parentNode === target) return () => {};

  const wrapper = target.ownerDocument.createElement("div");
  wrapper.setAttribute("data-bs-teleported", "");
  mirrorClasses(home, wrapper);
  let watcher: MutationObserver | null = null;
  if (home) {
    for (const name of Array.from(home.style)) {
      if (name.startsWith("--")) {
        wrapper.style.setProperty(name, home.style.getPropertyValue(name));
      }
    }
    homes.set(wrapper, home);
    if (typeof MutationObserver !== "undefined") {
      watcher = new MutationObserver(() => mirrorClasses(home, wrapper));
      watcher.observe(home, { attributes: true, attributeFilter: ["class"] });
    }
  }
  target.appendChild(wrapper);

  const records: Record[] = [];
  for (const el of nodes) {
    records.push({ el, parent: el.parentNode, next: el.nextSibling });
    wrapper.appendChild(el);
  }
  return () => {
    watcher?.disconnect();
    for (let i = records.length - 1; i >= 0; i--) {
      const { el, parent, next } = records[i]!;
      if (parent && parent.isConnected) {
        const before = next && next.parentNode === parent ? next : null;
        try {
          parent.insertBefore(el, before);
        } catch {
          el.parentNode?.removeChild(el);
        }
      } else {
        el.parentNode?.removeChild(el);
      }
    }
    homes.delete(wrapper);
    wrapper.parentNode?.removeChild(wrapper);
  };
};
