import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";
import "@surdeddd/bottom-sheet/styles";

const status = document.querySelector<HTMLElement>("#status");
if (!status) throw new Error("missing status node");

const root = document.createElement("div");
root.className = "bs-root";

const sheet = document.createElement("section");
sheet.className = "bs-sheet";
sheet.dataset.mode = "bottom";

const handle = document.createElement("div");
handle.className = "bs-handle";

const content = document.createElement("div");
content.className = "bs-content";
content.innerHTML = Array.from({ length: 100 }, (_, i) => {
  const n = i + 1;
  const mark = n % 10 === 0 ? " data-mark" : "";
  return `<div class="row" data-row="${n}"${mark}>row ${n}</div>`;
}).join("");

const footer = document.createElement("div");
footer.className = "bs-footer";
footer.innerHTML =
  '<span class="foot-label">Total</span><button type="button" data-action="gl">action</button>';

sheet.append(handle, content, footer);
root.append(sheet);
document.body.append(root);

const engine = new BottomSheetEngine({
  element: sheet,
  handle,
  scrollContainer: content,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "half", size: "50%" },
    { id: "full", size: "85%" },
  ],
  initial: "half",
  animation: "tween",
  duration: 220,
  lockBodyScroll: false,
  fitContentToSnap: true,
  features: [
    webglRenderer({
      onUnsupported: reason => {
        status.dataset.unsupported = reason;
      },
    }),
  ],
});

Object.assign(window as unknown as Record<string, unknown>, { bsGl: engine });
