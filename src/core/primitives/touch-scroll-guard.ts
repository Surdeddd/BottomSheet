/**
 * Pointer capture does not stop native touch scrolling — only a non-passive
 * preventDefault does. Kept separate so surfaces can opt in per drag.
 */
export function installTouchScrollGuard(
  surface: HTMLElement,
  isDragging: () => boolean,
): () => void {
  const onTouchMove = (e: TouchEvent): void => {
    if (!isDragging()) return;
    if (e.cancelable) e.preventDefault();
  };
  surface.addEventListener("touchmove", onTouchMove, { passive: false });
  return () => surface.removeEventListener("touchmove", onTouchMove);
}
