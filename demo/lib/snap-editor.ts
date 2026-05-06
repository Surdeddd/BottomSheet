import { $, type Settings } from "./types";

export type EditableSnap = { id: string; size: number };

// Single source of truth for the editor's seed list. Reused everywhere we
// need to know what the engine will fall back to once `customSnaps` is set
// back to null (empty list).
export const defaultSnaps = (): EditableSnap[] => [
  { id: "minimized", size: 110 },
  { id: "half", size: 320 },
  { id: "full", size: 620 },
];

let customSnaps: EditableSnap[] | null = null;

export const getCustomSnaps = (): EditableSnap[] | null => customSnaps;

// `shared.ts` reads `window.__bsCustomSnaps()` at every adapter mount —
// this getter is the single bridge to that side-channel.
declare global {
  interface Window {
    __bsCustomSnaps?: () => EditableSnap[] | null;
  }
}
window.__bsCustomSnaps = getCustomSnaps;

/**
 * Keep `settings.initial` valid after the user edits / removes snaps, or
 * after a permalink restore. If the active id no longer exists in the new
 * snap list, fall back to the smallest non-zero snap; if all snaps have
 * size 0, fall back to the first id. Without this guard, the engine starts
 * with `activeId` pointing at a missing snap, `size` stays at the default
 * 0, and the sheet renders fully off-screen.
 *
 * Accepts either the editor's narrow `EditableSnap` shape or the engine's
 * wider `SnapPointDef` shape (size can be a string like "85%" — we only
 * inspect identity + numeric > 0, so non-numeric sizes resolve as truthy).
 */
export const reconcileInitialSnap = (
  settings: Settings,
  snaps: ReadonlyArray<{ id: string; size: number | string }>,
): void => {
  if (snaps.length === 0) {
    console.warn(
      "[bs-demo] reconcileInitialSnap called with empty snap list — settings.initial left unchanged.",
    );
    return;
  }
  if (snaps.some(s => s.id === settings.initial)) return;
  const firstNonZero = snaps.find(
    s => (typeof s.size === "number" ? s.size : 1) > 0,
  );
  if (!firstNonZero) {
    console.warn(
      "[bs-demo] all snap points have size 0 — sheet will boot fully collapsed.",
    );
  }
  settings.initial = (firstNonZero ?? snaps[0]!).id;
};

export type SnapEditorDeps = {
  settings: Settings;
  onChange: () => void; // called after every mutation; should remount adapter
  onChipUpdate: () => void; // called after every mutation; should refresh chip row
};

export const mountSnapEditor = (deps: SnapEditorDeps): void => {
  const { settings, onChange, onChipUpdate } = deps;

  const render = (): void => {
    const list = $<HTMLUListElement>("#snap-editor");
    while (list.firstChild) list.removeChild(list.firstChild);
    const current = customSnaps ?? defaultSnaps();
    current.forEach((snap, i) => {
      const row = document.createElement("li");
      row.className = "snap-editor-row";

      const grip = document.createElement("span");
      grip.className = "snap-editor-handle";
      grip.textContent = "⋮⋮";
      grip.setAttribute("aria-hidden", "true");

      const idIn = document.createElement("input");
      idIn.value = snap.id;
      idIn.placeholder = "id";
      idIn.setAttribute("aria-label", `Snap ${i + 1} id`);

      const sizeIn = document.createElement("input");
      sizeIn.value = String(snap.size);
      sizeIn.placeholder = "size";
      sizeIn.type = "number";
      sizeIn.setAttribute("aria-label", `Snap ${i + 1} size in pixels`);

      const remove = document.createElement("button");
      remove.className = "remove";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove snap ${snap.id}`);

      const apply = (): void => {
        const next = (customSnaps ?? current).slice();
        next[i] = {
          id: idIn.value || `snap-${i}`,
          size: Number(sizeIn.value) || 0,
        };
        // Empty list collapses to `null` so `shared.ts` falls back to per-mode
        // defaults cleanly instead of returning `[]` (the guard treats them
        // identically but reconcile then can't recover the active id).
        customSnaps = next.length === 0 ? null : next;
        reconcileInitialSnap(settings, customSnaps ?? defaultSnaps());
        onChipUpdate();
        onChange();
      };
      idIn.addEventListener("change", apply);
      sizeIn.addEventListener("change", apply);
      remove.addEventListener("click", () => {
        const next = (customSnaps ?? current).filter((_, j) => j !== i);
        customSnaps = next.length === 0 ? null : next;
        reconcileInitialSnap(settings, customSnaps ?? defaultSnaps());
        render();
        onChipUpdate();
        onChange();
      });

      row.append(grip, idIn, sizeIn, remove);
      list.append(row);
    });
  };

  render();

  $<HTMLButtonElement>("#snap-add").addEventListener("click", () => {
    customSnaps = [
      ...(customSnaps ?? defaultSnaps()),
      { id: `snap-${Date.now() % 1000}`, size: 200 },
    ];
    render();
    onChange();
  });
};
