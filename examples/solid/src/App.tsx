/** @jsxImportSource solid-js */
import { onCleanup, onMount, For } from "solid-js";
import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

// Solid has no bundled adapter — wire the headless engine directly to refs.
export const App = () => {
  let sheetEl!: HTMLElement;
  let handleEl!: HTMLElement;
  let contentEl!: HTMLElement;
  let backdropEl!: HTMLElement;

  onMount(() => {
    const engine = new BottomSheetEngine({
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: backdropEl,
      mode: "bottom",
      snapPoints: [
        { id: "minimized", size: 96 },
        { id: "half", size: "45dvh" },
        { id: "full", size: "85%" },
      ],
      initial: "minimized",
      animation: "spring",
      spring: { stiffness: 260, damping: 28 },
      focusTrap: true,
      closeOnEscape: true,
    });
    backdropEl.addEventListener("click", () => void engine.close());
    onCleanup(() => engine.destroy());
  });

  const rows = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div class="page">
      <h1>Solid example</h1>
      <p>Drag the handle to expand the sheet.</p>

      <div class="bs-root">
        <div class="bs-backdrop" ref={backdropEl!} />
        <section class="bs-sheet" data-mode="bottom" role="dialog" ref={sheetEl!}>
          <div
            class="bs-handle"
            role="slider"
            tabIndex={0}
            aria-label="Resize sheet"
            ref={handleEl!}
          >
            <h2 style={{ margin: 0, padding: "12px 20px" }}>Search vehicles</h2>
          </div>
          <div class="bs-content" ref={contentEl!}>
            <ul class="sheet-list">
              <For each={rows}>{i => <li>Item #{i}</li>}</For>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};
