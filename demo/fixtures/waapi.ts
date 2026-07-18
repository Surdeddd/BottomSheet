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
sheet.id = "waapi-sheet";

const handle = document.createElement("div");
handle.className = "bs-handle";

const content = document.createElement("div");
content.className = "bs-content";
for (let i = 0; i < 6; i++) {
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
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "half", size: 300 },
    { id: "full", size: "80%" },
  ],
  initial: "closed",
  animation: "spring",
  settleAnimation: "waapi",
});

let waapiSeen = 0;
const watchAnimations = () => {
  if (sheet.getAnimations().length > 0) waapiSeen += 1;
  sheet.dataset.waapiSeen = String(waapiSeen);
  requestAnimationFrame(watchAnimations);
};
requestAnimationFrame(watchAnimations);

engine.on("opened", p => {
  sheet.dataset.openedAt = p.id;
});

document.querySelector("#snap-half")?.addEventListener("click", () => {
  void engine.snapTo("half");
});
document.querySelector("#snap-full")?.addEventListener("click", () => {
  void engine.snapTo("full");
});
document.querySelector("#close")?.addEventListener("click", () => {
  void engine.close();
});
