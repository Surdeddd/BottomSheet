/**
 * Touch-driven swipe gesture inside a sheet's scrollable content area:
 * pulling the content down at the top of scroll snaps the sheet to the
 * previous (smaller) snap; pulling up snaps to the next (larger) snap.
 * The vertical scroll itself remains native — we only intercept the
 * end-of-swipe to translate it into a snap directive.
 *
 * Returns a teardown removing the three touch listeners. No-ops at all
 * lifecycle events when the engine is dragging or animating, so the
 * gesture never competes with an in-flight handle drag.
 */

const CONTENT_PULL_THRESHOLD = 60;

export type ContentSwipeDeps = {
  /** The inner scroll container — listeners attach here, not the sheet root. */
  container: HTMLElement;
  /** Live engine flags — gesture disengages mid-drag/mid-animate. */
  isDragging: () => boolean;
  isAnimating: () => boolean;
  /** Allow-list of snap ids — used to find the prev/next neighbour. */
  getAllowedIds: () => string[];
  /** Currently active snap id — index into the allow-list. */
  getActiveId: () => string;
  /** Drive the engine — uses the public snapTo path so events fire normally. */
  snapTo: (id: string) => void;
};

export function installContentSwipe(deps: ContentSwipeDeps): () => void {
  const { container } = deps;
  let startY = 0;
  let moved = false;

  const onTouchStart = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (!t) return;
    startY = t.clientY;
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

/** @deprecated Use `installContentSwipe` — naming aligned with other `installX` factories. */
export const attachContentSwipe = installContentSwipe;
