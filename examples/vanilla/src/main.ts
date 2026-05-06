import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

const sheet = document.getElementById("sheet")!;
const handle = document.getElementById("handle")!;
const content = document.getElementById("content")!;
const backdrop = document.getElementById("backdrop")!;

const engine = new BottomSheetEngine({
  element: sheet,
  handle,
  scrollContainer: content,
  backdrop,
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

// Tap the backdrop to close — the engine doesn't bind this for you.
backdrop.addEventListener("click", () => void engine.close());
