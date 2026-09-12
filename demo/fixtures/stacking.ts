import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

type Nodes = {
  root: HTMLElement;
  sheet: HTMLElement;
  handle: HTMLElement;
  backdrop: HTMLElement;
};

const buildSheet = (caseName: string): Nodes => {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  const root = document.createElement("div");
  root.className = "bs-root";
  root.style.pointerEvents = "auto";
  const backdrop = document.createElement("div");
  backdrop.className = "bs-backdrop";
  backdrop.dataset.case = caseName;
  const sheet = document.createElement("section");
  sheet.className = "bs-sheet";
  sheet.dataset.mode = "bottom";
  sheet.dataset.case = caseName;
  const handle = document.createElement("div");
  handle.className = "bs-handle";
  const content = document.createElement("div");
  content.className = "bs-content";
  content.innerHTML = `<p style="margin:0;padding:16px">sheet ${caseName}</p>`;
  sheet.append(handle, content);
  root.append(backdrop, sheet);
  host.append(root);
  document.body.append(host);
  return { root, sheet, handle, backdrop };
};

const build = (caseName: string): BottomSheetEngine => {
  const n = buildSheet(caseName);
  return new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    backdrop: n.backdrop,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "half", size: "50%" },
      { id: "full", size: "85%" },
    ],
    initial: "closed",
    animation: "tween",
    duration: 160,
  });
};

const sheets: Record<string, BottomSheetEngine> = {
  A: build("A"),
  B: build("B"),
  C: build("C"),
};

const controls = document.getElementById("controls")!;

const addButton = (label: string, testId: string, run: () => void): void => {
  const button = document.createElement("button");
  button.textContent = label;
  button.dataset.testid = testId;
  button.addEventListener("click", run);
  controls.append(button);
};

for (const [name, engine] of Object.entries(sheets)) {
  addButton(`open ${name}`, `open-${name}`, () => void engine.open("half"));
  addButton(`close ${name}`, `close-${name}`, () => void engine.close());
}

const clicks = { count: 0 };
addButton("counter", "counter", () => {
  clicks.count += 1;
  controls.dataset.clicks = String(clicks.count);
});
controls.dataset.clicks = "0";

Object.assign(window as unknown as Record<string, unknown>, {
  bsSheets: sheets,
});
