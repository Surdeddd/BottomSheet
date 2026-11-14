import {
  BottomSheetEngine,
  createSheetManager,
  historySettled,
  type EngineState,
} from "@surdeddd/bottom-sheet";
import { BottomSheetCore } from "@surdeddd/bottom-sheet/core";
import {
  routeFeature,
  contentSwipeFeature,
  contentFitFeature,
  visualViewportFeature,
  persistFeature,
  autoCollapseFeature,
} from "@surdeddd/bottom-sheet/features";
import { OverlayEngine } from "@surdeddd/bottom-sheet/overlay";
import { attachDebugOverlay } from "@surdeddd/bottom-sheet/debug";
import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";
import {
  defineBottomSheet,
  type BottomSheetElement,
  type TypedBottomSheetElement,
} from "@surdeddd/bottom-sheet/element";
import "@surdeddd/bottom-sheet/styles";

const root = document.querySelector<HTMLElement>(".bs-root")!;
const backdrop = root.querySelector<HTMLElement>(".bs-backdrop")!;

const sheet = new BottomSheetEngine({
  element: root.querySelector<HTMLElement>(".bs-sheet")!,
  handle: root.querySelector<HTMLElement>(".bs-handle")!,
  scrollContainer: root.querySelector<HTMLElement>(".bs-content")!,
  backdrop,
  snapPoints: [
    { id: "closed", size: 0 },
    { id: "open", size: "fit" },
    { id: "half", size: "50%", dragFromContent: false },
  ],
  initial: "closed",
  focusTrap: true,
  backdropOpacity: 0.6,
  backdropColor: "rgb(0 0 0 / 0.4)",
  features: [webglRenderer({ jelly: 0.6 })],
});

document.querySelector("#filters")!.addEventListener("click", () => sheet.open());
backdrop.addEventListener("click", () => {
  if (sheet.canDismiss()) void sheet.close("backdrop");
});
sheet.on("closed", () => console.log("gone"));
sheet.on("snap", ({ id, size, progress }) => console.log(id, size, progress));
sheet.on("progress", ({ value }) => {
  document.documentElement.style.setProperty("--sheet-progress", String(value));
});
sheet.on("before-close", ({ reason, cancel }) => {
  if (reason === "backdrop") cancel();
});
sheet.on("before-snap", ({ id, previousId, cancel }) => {
  if (id === previousId) cancel();
});

const state: EngineState = sheet.state;
void state.phase;

export async function methods() {
  await sheet.open();
  await sheet.open("half");
  await sheet.close();
  await sheet.snapTo("open");
  await sheet.snapTo("open", { velocity: 0.2 });
  await sheet.expand();
  await sheet.collapse();
  await sheet.dragTo(300, { velocity: 0.1 });
  sheet.setAllowed(["half", "open"]);
  sheet.setAllowed(["half", "open"], "open");
  sheet.setSnapPoints([{ id: "open", size: 400 }], ["open"]);
  sheet.recompute();
  sheet.setMode("right");
  sheet.setPersistent(true);
  sheet.setDisableClose(true);
  sheet.setDisableDrag(true);
  sheet.setDragFrom("zones");
  sheet.setDragFromContent(false);
  sheet.setRadius("28px");
  sheet.setMaxHeight("92dvh");
  sheet.setBackdropOpacity(0.6);
  sheet.setBackdropColor("rgb(0 0 0 / 0.4)");
  sheet.setBackdropColor(null);
  sheet.setBackdropRange([0.4, 1]);
  sheet.setScreenRange([0.5, 1]);
  sheet.setScrim({ preset: "cinematic", tapToClose: true });
  sheet.setScrimMode("above-sheet");
  sheet.setScrimColor("rgb(15 15 20 / 0.55)");
  sheet.setScrimBlur("8px");
  sheet.setScrimEnabled(false);
  sheet.setScrimInteractive(true);
  sheet.setScrimTapToClose(true);
  sheet.getScrimState();
  const remove = sheet.setScrimOverlay({
    children: document.createElement("div"),
    position: "top-right",
    inset: "16px",
    interactive: true,
  });
  remove();
  const detach = sheet.addAnchor({
    element: document.createElement("button"),
    position: "sheet-top-right",
    showOn: ["half"],
    animation: "pop",
  });
  detach();
  sheet.getResolvedSnaps();
  sheet.getAllowedIds();
  sheet.canDismiss();
  sheet.isTop();
  sheet.depth();
  sheet.getMode();
  sheet.getDragFrom();
  void sheet.close();
  await historySettled();
  sheet.destroy();
}

const slim = new BottomSheetCore({
  element: root,
  handle: backdrop,
  snapPoints: [{ id: "open", size: 300 }],
  closeOnBack: true,
  features: [
    routeFeature(),
    contentSwipeFeature(),
    contentFitFeature(),
    visualViewportFeature(),
    persistFeature(),
    autoCollapseFeature(),
  ],
});
attachDebugOverlay(slim);

const sheets = createSheetManager<"home" | "place">({
  home: { snapPoints: [{ id: "peek", size: 96 }], allowed: ["peek"] },
  place: { snapPoints: [{ id: "half", size: "50%" }], allowed: ["half"], onOpen: () => {} },
});
sheets.transition("home", "place");
const config = sheets.resolve("place");
if (config?.snapPoints) sheet.setSnapPoints(config.snapPoints, config.allowed);

const overlay = new OverlayEngine({
  element: root,
  backdrop,
  edge: "bottom",
  preset: "sheet",
  swipeToClose: { threshold: 0.5 },
  mountTo: "body",
});
overlay.on("close", ({ reason }) => console.log("closed by", reason));
overlay.setOverlay({ preset: "dialog", backdropOpacity: 0.8 });
overlay.setBackdropOpacity(0.3);
overlay.setBackdropFilter("blur(12px)");
overlay.setSwipeToClose({ threshold: 0.5 });
overlay.setEnterAnimation("fade");
overlay.setExitAnimation("slide");
overlay.setReturnFocus(backdrop);
overlay.setOverlayChildren(document.createElement("div"));
overlay.clearOverlayChildren();
void overlay.toggle();
void overlay.state.isOpen;

const el = document.querySelector<BottomSheetElement>("bottom-sheet");
el?.toggleAttribute("open", true);
if (el) {
  el.options = { easing: t => t * t, autoCollapseAfter: 8000 };
  el.snap = "half";
  void el.sheetState;
  void el.getEngine();
  el.setMode("right");
  el.addEventListener("before-close", event => event.preventDefault());
}
const typed = document.querySelector("bottom-sheet") as TypedBottomSheetElement<"half" | "full"> | null;
void typed?.snapTo("full");
defineBottomSheet("app-sheet");
