import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

const mount = document.querySelector<HTMLElement>("#mount");
const idleMount = document.querySelector<HTMLElement>("#idle-mount");
if (!mount || !idleMount) throw new Error("missing mount nodes");

const buildSheet = (id: string) => {
  const root = document.createElement("div");
  root.className = "bs-root";
  root.dataset.sheet = id;

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

  sheet.append(handle, content);
  root.append(sheet);
  return { root, sheet, handle, content };
};

const main = buildSheet("main");
mount.append(main.root);

const addRows = (from: number, count: number) => {
  for (let i = 0; i < count; i++) {
    const row = document.createElement("p");
    row.className = "row";
    row.dataset.row = String(from + i);
    row.textContent = `Row ${from + i}`;
    main.content.append(row);
  }
};

addRows(1, 4);

const noDrag = document.createElement("div");
noDrag.className = "no-drag";
noDrag.setAttribute("data-bs-no-drag", "");
noDrag.textContent = "no-drag region";
main.content.append(noDrag);

addRows(5, 60);

const engine = new BottomSheetEngine({
  element: main.sheet,
  handle: main.handle,
  scrollContainer: main.content,
  mode: "bottom",
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "half", size: 300 },
    { id: "full", size: "85%", dragFromContent: false },
  ],
  allowed: ["closed", "half", "full"],
  initial: "closed",
  animation: "tween",
  duration: 120,
  lockBodyScroll: false,
});

main.sheet.dataset.active = engine.state.activeId;
engine.on("snap", payload => {
  main.sheet.dataset.active = String(payload.id);
});

// Several sheets that stay closed — the shadow-band case.
for (let i = 0; i < 6; i++) {
  const idle = buildSheet(`idle-${i}`);
  idleMount.append(idle.root);
  new BottomSheetEngine({
    element: idle.sheet,
    handle: idle.handle,
    scrollContainer: idle.content,
    mode: "bottom",
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "full", size: 400 },
    ],
    initial: "closed",
    animation: "tween",
    duration: 0,
    lockBodyScroll: false,
  });
}

for (const mode of ["handle", "sheet", "zones"] as const) {
  document.querySelector(`#from-${mode}`)?.addEventListener("click", () => {
    engine.setDragFrom(mode);
    main.sheet.dataset.dragFrom = engine.getDragFrom();
  });
}
main.sheet.dataset.dragFrom = engine.getDragFrom();

document.querySelector("#open-half")?.addEventListener("click", () => {
  void engine.snapTo("half");
});
document.querySelector("#open-full")?.addEventListener("click", () => {
  void engine.snapTo("full");
});
document.querySelector("#close")?.addEventListener("click", () => {
  void engine.close();
});
