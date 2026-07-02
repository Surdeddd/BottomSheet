const CONTENT_PULL_THRESHOLD = 60;

export type ContentSwipeDeps = {
  container: HTMLElement;
  isDragging: () => boolean;
  isAnimating: () => boolean;
  getAllowedIds: () => string[];
  getActiveId: () => string;
  snapTo: (id: string) => void;
};

export function installContentSwipe(deps: ContentSwipeDeps): () => void {
  const { container } = deps;
  let startY = 0;
  let startScrollTop = 0;
  let moved = false;

  const onTouchStart = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (!t) return;
    startY = t.clientY;
    startScrollTop = container.scrollTop;
    moved = false;
  };
  const onTouchMove = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (!t) return;
    if (Math.abs(t.clientY - startY) > CONTENT_PULL_THRESHOLD) moved = true;
  };
  const onTouchEnd = (e: TouchEvent): void => {
    if (!moved) return;
    if (deps.isDragging() || deps.isAnimating()) return;
    if (container.scrollTop !== startScrollTop) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const deltaY = t.clientY - startY;
    const atTop = container.scrollTop <= 0;
    const allowed = deps.getAllowedIds();
    const idx = allowed.indexOf(deps.getActiveId());
    if (idx === -1) return;
    if (atTop && deltaY > CONTENT_PULL_THRESHOLD && idx > 0) {
      deps.snapTo(allowed[idx - 1]!);
    } else if (deltaY < -CONTENT_PULL_THRESHOLD && idx < allowed.length - 1) {
      deps.snapTo(allowed[idx + 1]!);
    }
  };

  container.addEventListener("touchstart", onTouchStart, { passive: true });
  container.addEventListener("touchmove", onTouchMove, { passive: true });
  container.addEventListener("touchend", onTouchEnd, { passive: true });
  return () => {
    container.removeEventListener("touchstart", onTouchStart);
    container.removeEventListener("touchmove", onTouchMove);
    container.removeEventListener("touchend", onTouchEnd);
  };
}

export const attachContentSwipe = installContentSwipe;
