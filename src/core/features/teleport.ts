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

export const teleportElements = (
  els: ReadonlyArray<HTMLElement | null | undefined>,
  target: HTMLElement,
): (() => void) => {
  const records: Record[] = [];
  for (const el of els) {
    if (!el || el.parentNode === target) continue;
    records.push({ el, parent: el.parentNode, next: el.nextSibling });
    target.appendChild(el);
  }
  return () => {
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
  };
};
