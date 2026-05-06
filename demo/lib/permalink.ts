// URL-hash encoder/decoder for the demo's settings + active adapter.
// Format:  #mode=bottom&initial=minimized&stiff=260&damp=28&trap=1&esc=1&rubber=1&haptic=1&adapter=react
import type { DemoSettings } from "../apps/shared";
import { ADAPTERS, type AdapterKey } from "./types";

// Re-export so existing import sites that pulled `AdapterKey` from this
// module continue to work. The single source of truth now lives in `types.ts`.
export type { AdapterKey };

export type Permalink = {
  settings: Partial<DemoSettings>;
  adapter?: AdapterKey;
};

const MODES: DemoSettings["mode"][] = [
  "bottom",
  "top",
  "left",
  "right",
  "overlay",
];

const intInRange = (raw: string | null, lo: number, hi: number): number | null => {
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return n;
};

const flag = (raw: string | null): boolean | null =>
  raw === "1" ? true : raw === "0" ? false : null;

export function encode(settings: DemoSettings, adapter: AdapterKey): string {
  const p = new URLSearchParams();
  p.set("adapter", adapter);
  p.set("mode", settings.mode);
  p.set("initial", settings.initial);
  p.set("stiff", String(settings.stiffness));
  p.set("damp", String(settings.damping));
  p.set("trap", settings.focusTrap ? "1" : "0");
  p.set("esc", settings.closeOnEscape ? "1" : "0");
  p.set("rubber", settings.rubberBand ? "1" : "0");
  p.set("haptic", settings.haptic ? "1" : "0");
  return "#" + p.toString();
}

export function decode(hash: string): Permalink {
  const out: Permalink = { settings: {} };
  if (!hash.startsWith("#") || hash.length < 2) return out;
  const p = new URLSearchParams(hash.slice(1));

  const adapter = p.get("adapter");
  if (adapter && (ADAPTERS as readonly string[]).includes(adapter)) {
    out.adapter = adapter as AdapterKey;
  }
  const mode = p.get("mode");
  if (mode && (MODES as readonly string[]).includes(mode)) {
    out.settings.mode = mode as DemoSettings["mode"];
  }
  const initial = p.get("initial");
  if (initial && /^[a-z0-9_-]{1,32}$/i.test(initial)) {
    out.settings.initial = initial;
  }
  const stiff = intInRange(p.get("stiff"), 50, 1000);
  if (stiff != null) out.settings.stiffness = stiff;
  const damp = intInRange(p.get("damp"), 0, 100);
  if (damp != null) out.settings.damping = damp;
  for (const [k, prop] of [
    ["trap", "focusTrap"],
    ["esc", "closeOnEscape"],
    ["rubber", "rubberBand"],
    ["haptic", "haptic"],
  ] as const) {
    const v = flag(p.get(k));
    if (v != null) out.settings[prop] = v;
  }
  return out;
}

// Throttled hash writer — slider drags can fire 60 times/sec. We don't want
// every input event to push a history entry. Use replaceState so the back
// button still goes to where the user came from.
let writeTimer: number | null = null;
export function writeHash(hash: string): void {
  if (writeTimer != null) window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => {
    history.replaceState(null, "", hash);
    writeTimer = null;
  }, 250);
}
