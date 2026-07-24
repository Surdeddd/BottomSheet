import type { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { t } from "./i18n";

export type DragFromKey = "handle" | "sheet" | "zones";

export type DragSurfaceOptions = {
  getEngine: () => BottomSheetEngine | null;
  getScreen: () => HTMLElement | null;
  onChange?: () => void;
};

/**
 * The sheet header is the opt-in drag zone for "zones" mode. Marking it here
 * rather than in each adapter keeps all seven demos in sync from one place;
 * shadow-DOM adapters expose their sheet through the host's shadowRoot.
 */
const markZones = (screen: HTMLElement | null): void => {
  if (!screen) return;
  const roots: ParentNode[] = [screen];
  const host = screen.querySelector("bottom-sheet");
  if (host?.shadowRoot) roots.push(host.shadowRoot);
  for (const root of roots) {
    root
      .querySelectorAll<HTMLElement>(".sheet-header")
      .forEach(el => el.setAttribute("data-bs-drag", ""));
  }
};

export const wireDragSurface = (
  opts: DragSurfaceOptions,
): { syncToEngine: () => void; getState: () => { dragFrom: DragFromKey; dragFromContent: boolean } } => {
  const chips = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-dragfrom]"),
  );
  const contentToggle = document.getElementById(
    "tg-drag-content",
  ) as HTMLInputElement | null;
  const note = document.getElementById("dragfrom-note");

  let dragFrom: DragFromKey = "handle";
  let dragFromContent = true;

  const renderNote = (): void => {
    if (!note) return;
    note.textContent = t(`ctrl.drag.note.${dragFrom}`);
  };

  const apply = (): void => {
    const engine = opts.getEngine();
    if (!engine) return;
    markZones(opts.getScreen());
    engine.setDragFrom(dragFrom);
    engine.setDragFromContent(dragFromContent);
  };

  const syncToEngine = (): void => {
    apply();
    renderNote();
  };

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      const next = chip.dataset.dragfrom as DragFromKey | undefined;
      if (!next || next === dragFrom) return;
      dragFrom = next;
      for (const c of chips) c.classList.toggle("is-active", c === chip);
      syncToEngine();
      opts.onChange?.();
    });
  }

  contentToggle?.addEventListener("change", () => {
    dragFromContent = contentToggle.checked;
    syncToEngine();
    opts.onChange?.();
  });

  renderNote();
  return {
    syncToEngine,
    getState: () => ({ dragFrom, dragFromContent }),
  };
};
