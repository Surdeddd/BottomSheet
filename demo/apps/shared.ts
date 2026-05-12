import type {
  BottomSheetEngine,
  EngineState,
  SnapPointDef,
} from "@surdeddd/bottom-sheet";

declare global {
  interface Window {
    __bsCustomSnaps?: () => Array<{ id: string; size: number }> | null;
  }
}

export type ScrimPresetKey =
  | "off"
  | "subtle"
  | "standard"
  | "monitoring"
  | "cinematic";

export type DemoSettings = {
  mode: "bottom" | "top" | "left" | "right" | "overlay";
  initial: string;
  stiffness: number;
  damping: number;
  focusTrap: boolean;
  closeOnEscape: boolean;
  haptic: boolean;
  rubberBand: boolean;
  scrimPreset: ScrimPresetKey;
  scrimAboveSheet: boolean;
  scrimTapToClose: boolean;
  scrimFloatingAction: boolean;
};

export type DemoController = {
  destroy: () => void;
  snapTo: (id: string) => void;
  onUpdate: (fn: (state: EngineState) => void) => void;
  onVelocity: (fn: (v: number) => void) => void;
  getEngine?: () => BottomSheetEngine | null;
};

export const snapPoints = (mode: DemoSettings["mode"]): SnapPointDef[] => {
  const custom =
    typeof window !== "undefined" ? window.__bsCustomSnaps?.() : null;
  if (custom && custom.length > 0) {
    return custom;
  }
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

export const allowedFromSnaps = (mode: DemoSettings["mode"]): string[] =>
  snapPoints(mode).map(s => s.id);

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
