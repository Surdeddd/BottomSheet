export type FitObserverDeps = {
  handle: HTMLElement;
  scrollContainer: HTMLElement | undefined;
  hasFitSnap: () => boolean;
  isDestroyed: () => boolean;
  isDragging: () => boolean;
  recompute: () => void;
};

const contentTargets = (scroller: HTMLElement | undefined): Element[] => {
  if (!scroller) return [];
  const hasSlot = typeof HTMLSlotElement !== "undefined";
  const out: Element[] = [];
  for (const child of Array.from(scroller.children)) {
    if (hasSlot && child instanceof HTMLSlotElement) {
      for (const el of child.assignedElements()) out.push(el);
    } else {
      out.push(child);
    }
  }
  return out;
};

export function installFitObserver(deps: FitObserverDeps): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  if (!deps.hasFitSnap()) return () => {};
  let raf = 0;
  const schedule = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (deps.isDestroyed() || deps.isDragging()) return;
      deps.recompute();
    });
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(deps.handle);
  const scroller = deps.scrollContainer;
  const observed = new Set<Element>();
  const slots = new Set<HTMLSlotElement>();
  const hasSlot = typeof HTMLSlotElement !== "undefined";
  const onSlotChange = (): void => resync();
  const trackSlots = (): void => {
    if (!scroller || !hasSlot) return;
    for (const child of Array.from(scroller.children)) {
      if (child instanceof HTMLSlotElement && !slots.has(child)) {
        child.addEventListener("slotchange", onSlotChange);
        slots.add(child);
      }
    }
  };
  const resync = (): void => {
    trackSlots();
    const targets = contentTargets(scroller);
    for (const el of observed) {
      if (!targets.includes(el)) {
        ro.unobserve(el);
        observed.delete(el);
      }
    }
    for (const el of targets) {
      if (!observed.has(el)) {
        ro.observe(el);
        observed.add(el);
      }
    }
    schedule();
  };
  let mo: MutationObserver | undefined;
  if (scroller) {
    resync();
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(resync);
      mo.observe(scroller, { childList: true });
    }
  }
  return () => {
    ro.disconnect();
    mo?.disconnect();
    for (const slot of slots) {
      slot.removeEventListener("slotchange", onSlotChange);
    }
    if (raf) cancelAnimationFrame(raf);
  };
}
