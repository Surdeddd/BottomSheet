import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

type Nodes = {
  root: HTMLElement;
  sheet: HTMLElement;
  handle: HTMLElement;
  content: HTMLElement;
};

const spring = { stiffness: 260, damping: 28 };

const makeHost = (id: string): HTMLElement => {
  const host = document.createElement("div");
  host.id = id;
  host.style.cssText = "position:fixed;inset:0;";
  document.body.append(host);
  return host;
};

const buildSheet = (
  host: HTMLElement,
  caseName: string,
  contentHTML: string,
): Nodes => {
  const root = document.createElement("div");
  root.className = "bs-root";
  const backdrop = document.createElement("div");
  backdrop.className = "bs-backdrop";
  const sheet = document.createElement("section");
  sheet.className = "bs-sheet";
  sheet.dataset.mode = "bottom";
  sheet.dataset.case = caseName;
  const handle = document.createElement("div");
  handle.className = "bs-handle";
  const content = document.createElement("div");
  content.className = "bs-content";
  content.innerHTML = contentHTML;
  sheet.append(handle, content);
  root.append(backdrop, sheet);
  host.append(root);
  return { root, sheet, handle, content };
};

const tall = "<p style='height:400px;margin:0'>tall</p>";
const short = "<p style='margin:0'>x</p>";

const wireOpen = (e: BottomSheetEngine, sheet: HTMLElement): void => {
  sheet.dataset.openCount = "0";
  let count = 0;
  e.on("open", () => {
    count += 1;
    sheet.dataset.openCount = String(count);
  });
};

const engines: BottomSheetEngine[] = [];

const caseA = (): void => {
  const n = buildSheet(makeHost("host-a"), "A", tall);
  const e = new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "open", size: "fit" },
    ],
    initial: "closed",
    animation: "spring",
    spring,
  });
  engines.push(e);
  wireOpen(e, n.sheet);
  void e.snapTo("open");
};

const caseB = (): void => {
  const host = makeHost("host-b");
  const tele = document.createElement("div");
  tele.style.cssText = "position:fixed;inset:0;transform:translateZ(0);";
  document.body.append(tele);
  const n = buildSheet(host, "B", short);
  const e = new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "open", size: 300 },
    ],
    initial: "closed",
    animation: "spring",
    spring,
  });
  engines.push(e);
  wireOpen(e, n.sheet);
  tele.append(n.root);
  void e.snapTo("open");
};

const caseC = (): void => {
  const host = makeHost("host-c");
  host.style.display = "none";
  const n = buildSheet(host, "C", short);
  const e = new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "open", size: "85%" },
    ],
    initial: "closed",
    animation: "spring",
    spring,
  });
  engines.push(e);
  wireOpen(e, n.sheet);
  void e.snapTo("open");
  requestAnimationFrame(() => {
    host.style.display = "";
  });
};

const caseD = (): void => {
  const host = makeHost("host-d");
  host.style.display = "none";
  const n = buildSheet(host, "D", tall);
  const e = new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "open", size: "fit" },
    ],
    initial: "open",
    animation: "spring",
    spring,
  });
  engines.push(e);
  wireOpen(e, n.sheet);
  requestAnimationFrame(() => {
    host.style.display = "";
  });
};

const caseE = (): void => {
  const host = makeHost("host-e");
  host.style.display = "none";
  const n = buildSheet(host, "E", short);
  const e = new BottomSheetEngine({
    element: n.sheet,
    handle: n.handle,
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "open", size: "85%" },
    ],
    initial: "open",
    animation: "spring",
    spring,
  });
  engines.push(e);
  wireOpen(e, n.sheet);
  requestAnimationFrame(() => {
    host.style.display = "";
  });
};

caseA();
caseB();
caseC();
caseD();
caseE();
