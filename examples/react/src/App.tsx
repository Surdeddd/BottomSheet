import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

// Three snap points: peek (96px), half-screen, near-full.
const snapPoints = [
  { id: "minimized", size: 96 },
  { id: "half", size: "45dvh" },
  { id: "full", size: "85%" },
];

export const App = () => (
  <div className="page">
    <h1>React example</h1>
    <p>Drag the handle to expand the sheet.</p>

    <BottomSheet
      snapPoints={snapPoints}
      initial="minimized"
      animation="spring"
      spring={{ stiffness: 260, damping: 28 }}
      focusTrap
      closeOnEscape
      header={<h2 style={{ margin: 0, padding: "12px 20px" }}>Search vehicles</h2>}
    >
      <ul className="sheet-list">
        {Array.from({ length: 12 }, (_, i) => (
          <li key={i}>Item #{i + 1}</li>
        ))}
      </ul>
    </BottomSheet>
  </div>
);
