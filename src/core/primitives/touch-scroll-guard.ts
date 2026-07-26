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
