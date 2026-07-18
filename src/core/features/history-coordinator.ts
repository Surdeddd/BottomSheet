export type BackSurface = {
  isOpen(): boolean;
  isTop(): boolean;
  close(): Promise<void> | void;
  markerState(): Record<string, unknown>;
  url?: string;
};

export type MarkerHandle = { readonly __bsMarkerHandle: unique symbol };

type Entry = {
  surface: BackSurface;
  priorUrl: string | undefined;
  live: boolean;
};

type HistoryFn = History["pushState"];

const entries: Entry[] = [];
const subscribers = new Set<() => void>();

let suppress = 0;
let internalDepth = 0;
const pendingRebrands: Array<(() => void) | null> = [];

let listenerInstalled = false;
let patchInstalled = false;
let origPushState: HistoryFn | null = null;
let origReplaceState: HistoryFn | null = null;
let patchedPushState: HistoryFn | null = null;
let patchedReplaceState: HistoryFn | null = null;

const hasWindow = (): boolean => typeof window !== "undefined";
const hasHistory = (): boolean => typeof history !== "undefined";

const brandMarker = (surface: BackSurface): Record<string, unknown> => ({
  ...surface.markerState(),
  __bs: true,
});

const runInternal = (fn: () => void): void => {
  internalDepth += 1;
  try {
    fn();
  } finally {
    internalDepth -= 1;
  }
};

const notifyRouteChange = (): void => {
  const snapshot = Array.from(subscribers);
  for (const fn of snapshot) fn();
};

const ensureListener = (): void => {
  if (listenerInstalled || !hasWindow()) return;
  window.addEventListener("popstate", onPopState);
  listenerInstalled = true;
};

const maybeTeardownListener = (): void => {
  if (!listenerInstalled) return;
  if (entries.length > 0 || subscribers.size > 0 || suppress > 0) return;
  if (hasWindow()) window.removeEventListener("popstate", onPopState);
  listenerInstalled = false;
};

const installPatch = (): void => {
  if (patchInstalled || !hasHistory()) return;
  origPushState = history.pushState;
  origReplaceState = history.replaceState;
  patchedPushState = function (this: History, ...args): void {
    origPushState!.apply(this, args);
    if (internalDepth === 0) notifyRouteChange();
  } as HistoryFn;
  patchedReplaceState = function (this: History, ...args): void {
    origReplaceState!.apply(this, args);
    if (internalDepth === 0) notifyRouteChange();
  } as HistoryFn;
  history.pushState = patchedPushState;
  history.replaceState = patchedReplaceState;
  patchInstalled = true;
};

const removePatch = (): void => {
  if (!patchInstalled) return;
  if (history.pushState === patchedPushState && origPushState) {
    history.pushState = origPushState;
  }
  if (history.replaceState === patchedReplaceState && origReplaceState) {
    history.replaceState = origReplaceState;
  }
  origPushState = null;
  origReplaceState = null;
  patchedPushState = null;
  patchedReplaceState = null;
  patchInstalled = false;
};

function onPopState(): void {
  if (suppress > 0) {
    suppress -= 1;
    const rebrand = pendingRebrands.shift();
    if (rebrand) rebrand();
    maybeTeardownListener();
    return;
  }
  if (entries.length === 0) {
    notifyRouteChange();
    maybeTeardownListener();
    return;
  }
  let target: Entry | null = null;
  let targetIdx = -1;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i]!;
    if (!entry.surface.isOpen()) continue;
    if (!target) {
      target = entry;
      targetIdx = i;
    }
    if (entry.surface.isTop()) {
      target = entry;
      targetIdx = i;
      break;
    }
  }
  if (!target) {
    const removed = entries.pop();
    if (removed) removed.live = false;
    maybeTeardownListener();
    return;
  }
  target.live = false;
  entries.splice(targetIdx, 1);
  const settled = target;
  void Promise.resolve(settled.surface.close()).then(() => {
    if (settled.surface.isOpen()) restore(settled);
  });
  maybeTeardownListener();
}

function restore(entry: Entry): void {
  if (!hasWindow() || !hasHistory()) return;
  entry.live = true;
  runInternal(() => {
    try {
      history.pushState(brandMarker(entry.surface), "", entry.surface.url);
    } catch {
      entry.live = false;
    }
  });
  if (entry.live) {
    entries.push(entry);
    ensureListener();
  }
}

export function pushBackMarker(surface: BackSurface): MarkerHandle {
  const entry: Entry = { surface, priorUrl: undefined, live: false };
  if (!hasWindow() || !hasHistory()) {
    return entry as unknown as MarkerHandle;
  }
  entry.priorUrl = surface.url !== undefined ? location.href : undefined;
  runInternal(() => {
    try {
      history.pushState(brandMarker(surface), "", surface.url);
      entry.live = true;
    } catch {
      entry.live = false;
    }
  });
  if (entry.live) {
    entries.push(entry);
    ensureListener();
  }
  return entry as unknown as MarkerHandle;
}

export function popBackMarker(handle: MarkerHandle): void {
  if (!hasWindow() || !hasHistory()) return;
  const entry = handle as unknown as Entry;
  const idx = entries.indexOf(entry);
  if (idx === -1 || !entry.live) return;
  const last = entries.length - 1;
  entry.live = false;
  entries.splice(idx, 1);

  let rebrand: (() => void) | null = null;
  if (idx !== last) {
    const rebrandSurface = entries[entries.length - 1]!.surface;
    const rebrandUrl = entry.priorUrl;
    rebrand = (): void => {
      runInternal(() => {
        history.replaceState(
          brandMarker(rebrandSurface),
          "",
          rebrandUrl !== undefined ? rebrandUrl : location.href,
        );
      });
    };
  }

  pendingRebrands.push(rebrand);
  suppress += 1;
  runInternal(() => {
    try {
      history.back();
    } catch {
      suppress = Math.max(0, suppress - 1);
      pendingRebrands.pop();
    }
  });
  maybeTeardownListener();
}

export function subscribeRouteChange(fn: () => void): () => void {
  if (!hasWindow() || !hasHistory()) return () => {};
  subscribers.add(fn);
  if (subscribers.size === 1) installPatch();
  ensureListener();
  return () => {
    if (!subscribers.has(fn)) return;
    subscribers.delete(fn);
    if (subscribers.size === 0) removePatch();
    maybeTeardownListener();
  };
}

export const __resetHistoryCoordinatorForTests = (): void => {
  entries.length = 0;
  suppress = 0;
  internalDepth = 0;
  pendingRebrands.length = 0;
  removePatch();
  subscribers.clear();
  if (listenerInstalled && hasWindow()) {
    window.removeEventListener("popstate", onPopState);
  }
  listenerInstalled = false;
};
