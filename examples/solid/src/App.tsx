/** @jsxImportSource solid-js */
import { For } from "solid-js";
import { BottomSheet } from "@surdeddd/bottom-sheet/solid";
import "@surdeddd/bottom-sheet/styles";

const snapPoints = [
  { id: "minimized", size: 96 },
  { id: "half", size: "45dvh" },
  { id: "full", size: "85%" },
];

export const App = () => {
  const rows = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div class="page">
      <h1>Solid example</h1>
      <p>Drag the handle to expand the sheet.</p>

      <BottomSheet
        snapPoints={snapPoints}
        initial="minimized"
        animation="spring"
        spring={{ stiffness: 260, damping: 28 }}
        header={<h2 style={{ margin: 0 }}>Search vehicles</h2>}
      >
        <ul class="sheet-list">
          <For each={rows}>{i => <li>Item #{i}</li>}</For>
        </ul>
      </BottomSheet>
    </div>
  );
};
