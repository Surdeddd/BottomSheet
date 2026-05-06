/**
 * On iOS / Android, dragging the sheet handle while a textarea/input is
 * focused leaves the soft keyboard floating over the now-moving sheet —
 * which jitters as `visualViewport.height` changes mid-drag and looks
 * broken. Engine calls this on `pointerdown` to dismiss the keyboard
 * BEFORE the drag begins, so the viewport stays stable.
 *
 * Returns `true` when a focused editable was actually blurred — engine
 * uses the return as a flag to avoid emitting double-blur cycles.
 *
 * @internal
 */
export function dismissSoftKeyboardIfFocused(root: HTMLElement): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as
    | (HTMLElement & { isContentEditable?: boolean })
    | null;
  if (!active) return false;
  if (!root.contains(active)) return false;
  const tag = active.tagName;
  const isEditable =
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    active.isContentEditable === true;
  if (!isEditable) return false;
  try {
    active.blur();
    return true;
  } catch {
    // Some shadow-DOM / detached scenarios throw on blur(). Treat as no-op.
    return false;
  }
}
