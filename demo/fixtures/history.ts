import { BottomSheetEngine, historySettled } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

type SheetOptions = {
  closeOnBack?: boolean;
  routedTo?: string;
  closeOnRouteChange?: boolean;
  persistent?: boolean;
  duration?: number;
  initial?: string;
};

const sheets = new Map<string, BottomSheetEngine>();

const sheetOf = (name: string): BottomSheetEngine => {
  const engine = sheets.get(name);
  if (!engine) throw new Error(`unknown sheet: ${name}`);
  return engine;
};

const create = (name: string, options: SheetOptions = {}): void => {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  const root = document.createElement("div");
  root.className = "bs-root";
  root.style.pointerEvents = "auto";
  const backdrop = document.createElement("div");
  backdrop.className = "bs-backdrop";
  const sheet = document.createElement("section");
  sheet.className = "bs-sheet";
  sheet.dataset.mode = "bottom";
  sheet.dataset.case = name;
  const handle = document.createElement("div");
  handle.className = "bs-handle";
  const content = document.createElement("div");
  content.className = "bs-content";
  const link = document.createElement("a");
  link.href = "#details";
  link.dataset.testid = `hash-${name}`;
  link.textContent = `details of ${name}`;
  link.style.cssText = "display:block;padding:16px;";
  content.append(link);
  sheet.append(handle, content);
  root.append(backdrop, sheet);
  host.append(root);
  document.body.append(host);

  const { duration = 120, initial = "closed", ...rest } = options;
  sheets.set(
    name,
    new BottomSheetEngine({
      element: sheet,
      handle,
      backdrop,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "full", size: "60%" },
      ],
      initial,
      animation: "tween",
      duration,
      ...rest,
    }),
  );
};

const api = {
  create,
  open: (name: string): Promise<void> => sheetOf(name).open("full"),
  close: (name: string): Promise<void> => sheetOf(name).close(),
  destroy: (name: string): void => {
    sheetOf(name).destroy();
    sheets.delete(name);
  },
  isOpen: (name: string): boolean => sheetOf(name).state.phase !== "closed",
  settled: (): Promise<void> => historySettled(),
};

Object.assign(window as unknown as Record<string, unknown>, {
  bsHistory: api,
});
