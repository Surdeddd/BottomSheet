import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

const ROWS = 100;

const buildSheet = (caseName: string): {
  sheet: HTMLElement;
  handle: HTMLElement;
  content: HTMLElement;
} => {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  const root = document.createElement("div");
  root.className = "bs-root";
  root.style.pointerEvents = "auto";
  const sheet = document.createElement("section");
  sheet.className = "bs-sheet";
  sheet.dataset.mode = "bottom";
  sheet.dataset.case = caseName;
  const handle = document.createElement("div");
  handle.className = "bs-handle";
  const content = document.createElement("div");
  content.className = "bs-content";
  content.dataset.case = caseName;
  content.innerHTML = Array.from(
    { length: ROWS },
    (_, i) => `<div class="row" data-row="${i + 1}">row ${i + 1}</div>`,
  ).join("");
  sheet.append(handle, content);
  root.append(sheet);
  host.append(root);
  document.body.append(host);
  return { sheet, handle, content };
};

const build = (caseName: string, fitContentToSnap: boolean): BottomSheetEngine => {
  const n = buildSheet(caseName);
  return new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    scrollContainer: n.content,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: "50%" },
      { id: "full", size: "85%" },
    ],
    initial: "closed",
    animation: "tween",
    duration: 220,
    lockBodyScroll: false,
    fitContentToSnap,
  });
};

Object.assign(window as unknown as Record<string, unknown>, {
  bsSheets: {
    fit: build("fit", true),
    plain: build("plain", false),
  },
});
