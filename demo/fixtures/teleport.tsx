import { createRoot } from "react-dom/client";
import { BottomSheet } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

const App = () => (
  <BottomSheet
    snapPoints={[
      { id: "closed", size: 0 },
      { id: "half", size: 280 },
    ]}
    initial="half"
    animation="tween"
    lockBodyScroll={false}
    teleportTo="body"
    leftButton={
      <button type="button" data-testid="left-button">
        left
      </button>
    }
    header={<h2>Teleported</h2>}
  >
    <p style={{ padding: "16px" }}>content</p>
  </BottomSheet>
);

createRoot(document.getElementById("app")!).render(<App />);
