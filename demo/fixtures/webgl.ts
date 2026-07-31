import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";
import "@surdeddd/bottom-sheet/styles";

const mount = document.querySelector<HTMLElement>("#mount");
const status = document.querySelector<HTMLElement>("#status");
if (!mount || !status) throw new Error("missing mount nodes");

const root = document.createElement("div");
root.className = "bs-root";

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

const body = document.createElement("div");
body.className = "sheet-body";
body.textContent = "GPU-rendered surface, DOM content";
content.append(body);

const card = document.createElement("div");
card.className = "sheet-card";
card.textContent = "Card with a background and a border";
content.append(card);

const swatch = document.createElement("img");
swatch.className = "sheet-swatch";
swatch.alt = "";
swatch.width = 48;
swatch.height = 48;
swatch.src =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">' +
      '<rect width="48" height="48" rx="10" fill="#ff6b4a"/></svg>',
  );
content.append(swatch);

sheet.append(handle, content);
root.append(sheet);
mount.append(root);

const engine = new BottomSheetEngine({
  element: sheet,
  handle,
  scrollContainer: content,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "minimized", size: 140 },
    { id: "full", size: "80%" },
  ],
  initial: "minimized",
  features: [
    webglRenderer({
      jelly: 0.7,
      onUnsupported: reason => {
        status.dataset.unsupported = reason;
        status.textContent = `renderer: dom (${reason})`;
      },
    }),
  ],
});

if (!status.dataset.unsupported) {
  status.textContent = "renderer: webgl";
}

document.querySelector("#to-full")?.addEventListener("click", () => {
  void engine.snapTo("full");
});
document.querySelector("#to-min")?.addEventListener("click", () => {
  void engine.snapTo("minimized");
});
document.querySelector("#lose-context")?.addEventListener("click", () => {
  const canvas = document.querySelector("canvas");
  const gl = canvas?.getContext("webgl");
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
});

declare global {
  interface Window {
    __webglEngine: BottomSheetEngine;
  }
}
window.__webglEngine = engine;
