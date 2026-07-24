export type DragFrom = "handle" | "sheet" | "zones";

export const DRAG_ZONE_SELECTOR = "[data-bs-drag]";
export const NO_DRAG_SELECTOR = "[data-bs-no-drag]";

type ClosestLike = { closest: (selector: string) => Element | null };

const asElement = (target: EventTarget | null): ClosestLike | null => {
  const candidate = target as Partial<ClosestLike> | null;
  return candidate && typeof candidate.closest === "function"
    ? (candidate as ClosestLike)
    : null;
};

/** Whether a pointer landing on `target` may start a sheet drag. */
export function isDragAllowedFrom(
  target: EventTarget | null,
  mode: DragFrom,
): boolean {
  const el = asElement(target);
  if (!el) return mode !== "zones";
  if (el.closest(NO_DRAG_SELECTOR)) return false;
  if (mode === "zones") return el.closest(DRAG_ZONE_SELECTOR) !== null;
  return true;
}
