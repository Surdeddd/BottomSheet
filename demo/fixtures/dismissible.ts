import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

const mount = document.querySelector<HTMLElement>("#mount");
if (!mount) throw new Error("missing #mount");

const root = document.createElement("div");
root.className = "bs-root";

const backdrop = document.createElement("div");
backdrop.className = "bs-backdrop";

const sheet = document.createElement("section");
sheet.className = "bs-sheet";
sheet.dataset.mode = "bottom";
sheet.setAttribute("role", "dialog");

const handle = document.createElement("div");
handle.className = "bs-handle";
handle.setAttribute("role", "slider");
handle.setAttribute("tabindex", "0");
handle.setAttribute("aria-label", "Resize sheet");

const content = document.createElement("div");
content.className = "bs-content";
content.setAttribute("tabindex", "0");
content.setAttribute("role", "region");
content.setAttribute("aria-label", "Sheet content");
for (let i = 0; i < 8; i++) {
  const row = document.createElement("p");
  row.textContent = `Row ${i + 1}`;
  content.append(row);
}

sheet.append(handle, content);
root.append(backdrop, sheet);
mount.append(root);

const engine = new BottomSheetEngine({
  element: sheet,
  handle,
  scrollContainer: content,
  backdrop,
  mode: "bottom",
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "half", size: 300 },
    { id: "full", size: "85%" },
  ],
  allowed: ["closed", "half", "full"],
  initial: "half",
  animation: "spring",
  closeOnEscape: true,
  lockBodyScroll: false,
});

sheet.dataset.active = engine.state.activeId;
engine.on("snap", payload => {
  sheet.dataset.active = String(payload.id);
});

document.querySelector("#open")?.addEventListener("click", () => {
  void engine.open("half");
});
document.querySelector("#close")?.addEventListener("click", () => {
  void engine.close();
});
