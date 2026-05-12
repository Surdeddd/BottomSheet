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
    return false;
  }
}
