import type { SheetMode } from "../types";

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
