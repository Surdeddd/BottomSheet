import { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import { contentLift, webglRenderer } from "@surdeddd/bottom-sheet/webgl";
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
const params = new URLSearchParams(location.search);
const surface = params.get("surface");
if (surface) sheet.style.background = surface;
if (params.get("theme") === "variable") mount.dataset.themed = "";
const frame = params.get("frame");
if (frame) mount.dataset.frame = frame;
const freeScroll = params.get("lock") === "off";
if (freeScroll) document.body.classList.add("tall");
if (params.get("scheme") === "follow") {
  document.documentElement.classList.add("follow-scheme");
}
if (params.has("animated")) document.documentElement.classList.add("animated");

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

if (params.has("rich")) {
  const announcer = document.createElement("span");
  announcer.className = "rich-hidden";
  announcer.setAttribute("aria-live", "polite");
  announcer.textContent = "minimized";

  const label = document.createElement("p");
  label.className = "rich-label";
  label.textContent = "Route overview";

  const text = document.createElement("p");
  text.className = "rich-text";
  text.append("The convoy leaves Munich at dawn and reaches ");
  const strong = document.createElement("b");
  strong.textContent = "Vienna";
  text.append(strong, " before noon, with one stop to refuel on the way.");

  const row = document.createElement("div");
  row.className = "rich-row";
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", "12");
  dot.setAttribute("cy", "12");
  dot.setAttribute("r", "9");
  dot.setAttribute("fill", "currentColor");
  icon.append(dot);
  const rowText = document.createElement("span");
  rowText.textContent = "Three stops on this route";
  row.append(icon, rowText);

  const badge = document.createElement("div");
  badge.className = "rich-badge";
  badge.textContent = "Gradient badge";

  content.prepend(announcer, label, text, row, badge);
}

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
    { id: "full", size: frame ? 400 : "80%" },
  ],
  initial: "minimized",
  ...(params.has("slow")
    ? { animation: "linear" as const, duration: Number(params.get("slow")) }
    : {}),
  lockBodyScroll: !freeScroll,
  features: [
    webglRenderer({
      jelly: Number(params.get("jelly") ?? 0.7),
      allowSoftware: params.get("software") !== "refuse",
      lift: params.has("lift") ? contentLift() : undefined,
      ...(params.has("sheen") ? { sheen: Number(params.get("sheen")) } : {}),
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

  const gl =
    canvas?.getContext("webgl2") ??
    (canvas?.getContext("webgl") as WebGLRenderingContext | null);
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
});

declare global {
  interface Window {
    __webglEngine: BottomSheetEngine;
  }
}
window.__webglEngine = engine;
