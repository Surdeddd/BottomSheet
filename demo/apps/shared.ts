import type {
  BottomSheetEngine,
  EngineState,
  SnapPointDef,
} from "@surdeddd/bottom-sheet";

declare global {
  interface Window {
    /** Snap-point editor side-channel: returns the user-edited snap list,
     *  or null when no edits are active. Defined in `demo/main.ts`. */
    __bsCustomSnaps?: () => Array<{ id: string; size: number }> | null;
  }
}

export type DemoSettings = {
  mode: "bottom" | "top" | "left" | "right" | "overlay";
  initial: string;
  stiffness: number;
  damping: number;
  focusTrap: boolean;
  closeOnEscape: boolean;
  haptic: boolean;
  rubberBand: boolean;
};

export type DemoController = {
  destroy: () => void;
  snapTo: (id: string) => void;
  onUpdate: (fn: (state: EngineState) => void) => void;
  onVelocity: (fn: (v: number) => void) => void;
  /**
   * Live-tweak hook for the Scrim Studio panel. Adapters that hold a direct
   * `BottomSheetEngine` reference return it here; framework adapters that
   * own the engine lifecycle return null (panel renders read-only state).
   */
  getEngine?: () => BottomSheetEngine | null;
};

/**
 * Snap points sized to the device-frame (~720×360). Absolute px because the
 * sheet's "%" resolver reads `window.innerHeight`, not the bezel — passing
 * "85%" would overflow the frame on desktop.
 *
 * The advanced playground's snap-point editor exposes a getter at
 * `window.__bsCustomSnaps`. When the user edits snaps live, this returns
 * the user-edited list **as-is** — we deliberately do NOT auto-prepend a
 * `closed` snap. The user is in control: if they want close-on-drag-down
 * they add a `closed: 0` row in the editor themselves. Auto-prepending used
 * to break the "remove all snaps except `full`" case where drag-down would
 * still settle to the synthetic closed snap and the sheet vanished.
 *
 * **Empty / null semantics** — `customSnaps === null` (editor untouched)
 * returns the per-mode defaults; `customSnaps === []` (every row removed)
 * also falls back to defaults via the `length > 0` guard. The editor's
 * `apply`/`remove` callbacks deliberately collapse `[]` back to `null` so
 * the fallback is consistent.
 */
export const snapPoints = (mode: DemoSettings["mode"]): SnapPointDef[] => {
  const custom =
    typeof window !== "undefined" ? window.__bsCustomSnaps?.() : null;
  if (custom && custom.length > 0) {
    // Don't auto-prepend a `closed` snap — if the user edits the list, they
    // are in charge. Auto-prepending would let drag-down settle to size 0
    // (sheet disappears) even when the user kept only `full`. They can add
    // a `closed` row in the editor themselves to enable close-on-drag-down.
    return custom;
  }
  // Sized for the 360×720 device bezel. Side modes resolve "%" against
  // window.innerWidth; we hard-code px so the sheet stays contained.
  if (mode === "left" || mode === "right") {
    return [
      { id: "closed", size: 0 },
      { id: "minimized", size: 60 },
      { id: "half", size: 180 },
      { id: "full", size: 300 },
    ];
  }
  if (mode === "top") {
    return [
      { id: "closed", size: 0 },
      { id: "minimized", size: 80 },
      { id: "half", size: 280 },
      { id: "full", size: 580 },
    ];
  }
  return [
    { id: "closed", size: 0 },
    { id: "minimized", size: 110 },
    { id: "half", size: 320 },
    { id: "full", size: 620 },
  ];
};

/** Derive the `allowed` list from snap points so custom snaps from the
 *  editor are activatable without re-coding each adapter. */
export const allowedFromSnaps = (mode: DemoSettings["mode"]): string[] =>
  snapPoints(mode).map(s => s.id);

/** Demo content rows used inside every adapter's sheet body. */
export const demoRows: Array<[title: string, sub: string]> = [
  ["Truck #4023 · westbound", "Munich → Vienna · ETA 2h 18m"],
  ["Sensor cluster β-7", "Pressure 2.4 bar · stable"],
  ["Route 14", "Vienna ⇄ Berlin · 3 stops"],
  ["Driver: A. Marchenko", "Hours 4:32 · within limit"],
  ["Fuel reading", "62% · refuel @ stop 02"],
  ["Maintenance window", "18:00 · brake check"],
  ["Geofence event", "Zone-K entered · 12:04"],
  ["Cabin temp", "21.4°C · climate ok"],
  ["Speed advisory", "Suggest -10 km/h · weather"],
  ["Cargo manifest", "#228841 · 14 pallets"],
  ["Battery health", "94% · projection +18mo"],
  ["Last sync", "12s ago · 5G"],
  ["Tachograph", "Reading OK · stamped"],
  ["Inbound checkpoint", "4 km · pre-arrival queue"],
];

/** Builds the device-frame chrome (status bar, banner, floating card). */
export const buildShell = (host: HTMLElement, kicker: string): HTMLElement => {
  while (host.firstChild) host.removeChild(host.firstChild);
  const shell = document.createElement("div");
  shell.className = "demo-shell";

  const status = document.createElement("div");
  status.className = "demo-status-bar";
  const left = document.createElement("span");
  left.textContent = "9:41";
  const right = document.createElement("span");
  const sig = document.createElement("span");
  sig.style.opacity = "0.7";
  sig.textContent = "5G";
  const sep = document.createElement("span");
  sep.style.opacity = "0.7";
  sep.textContent = " · ";
  const bat = document.createElement("span");
  bat.textContent = "100%";
  right.append(sig, sep, bat);
  status.append(left, right);

  const banner = document.createElement("div");
  banner.className = "demo-banner";
  const k = document.createElement("span");
  k.className = "demo-banner-kicker";
  k.textContent = kicker;
  const t = document.createElement("h1");
  t.className = "demo-banner-title";
  t.textContent = "Fleet Atlas";
  const s = document.createElement("p");
  s.className = "demo-banner-sub";
  s.textContent = "Drag the handle below to expand the dispatcher.";
  banner.append(k, t, s);

  const card = document.createElement("div");
  card.className = "demo-card";
  const icon = document.createElement("div");
  icon.className = "demo-card-icon";
  const txt = document.createElement("div");
  txt.className = "demo-card-text";
  const cardStrong = document.createElement("strong");
  cardStrong.textContent = "247 active vehicles";
  const cardSpan = document.createElement("span");
  cardSpan.textContent = "last update · 12 seconds ago";
  txt.append(cardStrong, cardSpan);
  card.append(icon, txt);

  shell.append(status, banner, card);
  host.append(shell);
  return shell;
};

/** Build a list-item DOM node for the sheet body. */
export const buildItem = (title: string, sub: string): HTMLElement => {
  const item = document.createElement("div");
  item.className = "sheet-item";
  const dot = document.createElement("div");
  dot.className = "sheet-item-dot";
  const text = document.createElement("div");
  text.className = "sheet-item-text";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = sub;
  text.append(strong, span);
  item.append(dot, text);
  return item;
};
