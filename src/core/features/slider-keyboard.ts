import type { TransformAxis } from "../primitives/transform";

export type SliderKeyboardDeps = {
  handle: HTMLElement;
  mode: TransformAxis;
  isDestroyed: () => boolean;
  getAllowedIds: () => string[];
  getActiveId: () => string;
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
