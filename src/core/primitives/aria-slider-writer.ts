import type { SheetMode } from "../types";

/**
 * Writes WAI-ARIA slider attributes (`aria-valuemin/max/now/valuetext`) on the
 * sheet's drag handle. Engine owns when to call (constructor, setAllowed,
 * setSnapPoints, snapTo settle); the writer owns the attribute names + the
 * "no allowed snaps → strip attributes" branch so screen readers don't
 * announce a stale slider position when the slider is disabled.
 *
 * `aria-orientation` is set ONCE in the constructor (mode is fixed for the
 * engine's lifetime) so subsequent `setValue()` calls only touch the dynamic
 * value attributes — keeps the per-snap call cheap.
 *
 * @internal
 */
export class AriaSliderWriter {
  constructor(
    private readonly handle: HTMLElement,
    mode: SheetMode,
  ) {
    handle.setAttribute(
      "aria-orientation",
      mode === "bottom" || mode === "top" ? "vertical" : "horizontal",
    );
  }

  /**
   * Update slider position. `allowedIds` length determines `aria-valuemax`;
   * `activeId` indexes into it for `aria-valuenow` + `aria-valuetext`.
   * Empty list → strip every dynamic attr so AT skips the handle entirely.
   */
  setValue(allowedIds: readonly string[], activeId: string): void {
    if (allowedIds.length === 0) {
      this.handle.removeAttribute("aria-valuemin");
      this.handle.removeAttribute("aria-valuemax");
      this.handle.removeAttribute("aria-valuenow");
      this.handle.removeAttribute("aria-valuetext");
      return;
    }
    const max = Math.max(allowedIds.length - 1, 0);
    const idx = Math.max(allowedIds.indexOf(activeId), 0);
    this.handle.setAttribute("aria-valuemin", "0");
    this.handle.setAttribute("aria-valuemax", String(max));
    this.handle.setAttribute("aria-valuenow", String(idx));
    this.handle.setAttribute("aria-valuetext", activeId);
  }
}
