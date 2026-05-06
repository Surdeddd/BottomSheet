import type { TransformAxis } from "../primitives/transform";

/**
 * ARIA slider keyboard control. Required by WCAG 2.5.7 (Dragging Movements)
 * as a single-pointer alternative — keyboard users navigate snap points via
 * Arrow keys (axis-appropriate), Home (first snap), End (last snap).
 *
 * Axis mapping:
 *   - vertical sheets (`bottom` / `top`):  ArrowUp = expand, ArrowDown = collapse
 *   - horizontal sheets (`left` / `right`): ArrowRight = expand, ArrowLeft = collapse
 *
 * `top` mode inverts: ArrowDown expands (the sheet grows down from the top
 * edge), ArrowUp collapses.
 *
 * Listens on `handle` (the slider element). Returns a teardown that removes
 * the keydown listener.
 */
export type SliderKeyboardDeps = {
  /** Element with `role="slider"` — the key listener attaches here. */
  handle: HTMLElement;
  /** Mode is fixed for the engine's lifetime — no live accessor needed. */
  mode: TransformAxis;
  /** Live engine state. */
  isDestroyed: () => boolean;
  /** Live allow-list — keyboard nav respects runtime allowed-id changes. */
  getAllowedIds: () => string[];
  /** Currently active snap id — index into the allow-list. */
  getActiveId: () => string;
  /** Drive the engine — uses public snapTo so events fire normally. */
  snapTo: (id: string) => void;
};

export function installSliderKeyboard(deps: SliderKeyboardDeps): () => void {
  const isVerticalAxis = deps.mode === "bottom" || deps.mode === "top";
  const stepUp = isVerticalAxis ? "ArrowUp" : "ArrowRight";
  const stepDown = isVerticalAxis ? "ArrowDown" : "ArrowLeft";
  const sheetExpandsKey = deps.mode === "top" ? stepDown : stepUp;
  const sheetCollapsesKey = deps.mode === "top" ? stepUp : stepDown;

  const onHandleKey = (e: KeyboardEvent): void => {
    if (deps.isDestroyed()) return;
    const allowed = deps.getAllowedIds();
    const idx = allowed.indexOf(deps.getActiveId());
    if (idx === -1) return;
    if (e.key === sheetExpandsKey && idx < allowed.length - 1) {
      e.preventDefault();
      deps.snapTo(allowed[idx + 1]!);
    } else if (e.key === sheetCollapsesKey && idx > 0) {
      e.preventDefault();
      deps.snapTo(allowed[idx - 1]!);
    } else if (e.key === "Home") {
      e.preventDefault();
      deps.snapTo(allowed[0]!);
    } else if (e.key === "End") {
      e.preventDefault();
      deps.snapTo(allowed[allowed.length - 1]!);
    }
  };

  deps.handle.addEventListener("keydown", onHandleKey);
  return () => deps.handle.removeEventListener("keydown", onHandleKey);
}
