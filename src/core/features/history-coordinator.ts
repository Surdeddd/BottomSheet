import { shared } from "../primitives/shared";

export type BackSurface = {
  isOpen(): boolean;
  close(): Promise<void> | void;
  markerState(): Record<string, unknown>;
  url?: string;
};

export type MarkerHandle = { readonly __bsMarkerHandle: unique symbol };

type Entry = { surface: BackSurface };

type HistoryFn = History["pushState"];
type Patch = { wrapper: HistoryFn; original: HistoryFn };
type TraversalKind = "pop" | "skip";

type CoordinatorState = {
  live: Entry[];
  stackId: string | undefined;
  baseUrl: string | undefined;
  position: number | null;
  knownLength: number;
  href: string;
  subscribers: Set<() => void>;
  internal: number;
  pending: TraversalKind[];
  deferred: Entry[];
  waiters: Array<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
  listening: boolean;
  leftovers: boolean;
  orphanChecked: boolean;
  push: Patch | null;
  replace: Patch | null;
};

const MARKER = "__bs";
const STACK = "__bsStack";
const DEPTH = "__bsDepth";
const ROUTED = "__bsRouted";
const SETTLE_TIMEOUT_MS = 1000;

const state = shared(
  "history",
  (): CoordinatorState => ({
    live: [],
    stackId: undefined,
    baseUrl: undefined,
    position: null,
    knownLength: 0,
    href: "",
    subscribers: new Set(),
    internal: 0,
    pending: [],
    deferred: [],
    waiters: [],
    timer: null,
    listening: false,
    leftovers: false,
    orphanChecked: false,
    push: null,
    replace: null,
  }),
);

const hasHistory = (): boolean =>
  typeof window !== "undefined" && typeof history !== "undefined";

const plain = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const depthOf = (value: Record<string, unknown> | null): number | null => {
  const depth = value?.[DEPTH];
  return typeof depth === "number" ? depth : null;
};

const isMarker = (value: Record<string, unknown> | null): boolean =>
  value?.[MARKER] === true;

const inStack = (value: Record<string, unknown> | null): boolean =>
  value !== null &&
  state.stackId !== undefined &&
  value[STACK] === state.stackId &&
  depthOf(value) !== null;

const foreignKeys = (value: unknown): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const source = plain(value);
  if (!source) return out;
  for (const key of Object.keys(source)) {
    if (!key.startsWith(MARKER)) out[key] = source[key];
  }
  return out;
};

const markerFor = (
  surface: BackSurface,
  depth: number,
): Record<string, unknown> => ({
  ...foreignKeys(history.state),
  ...surface.markerState(),
  [MARKER]: true,
  [STACK]: state.stackId,
  [DEPTH]: depth,
});

const urlForDepth = (depth: number): string | undefined => {
  for (let i = depth - 1; i >= 0; i -= 1) {
    const url = state.live[i]?.surface.url;
    if (url !== undefined) return url;
  }
  return state.baseUrl;
};

const runInternal = (fn: () => void): boolean => {
  state.internal += 1;
  try {
    fn();
    return true;
  } catch {
    return false;
  } finally {
    state.internal -= 1;
  }
};

const notifyRouteChange = (): void => {
  for (const fn of Array.from(state.subscribers)) {
    try {
      fn();
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
  }
};

const ensureListener = (): void => {
  if (state.listening || !hasHistory()) return;
  window.addEventListener("popstate", onPopState);
  state.listening = true;
};

const maybeTeardownListener = (): void => {
  if (!state.listening) return;
  if (
    state.live.length > 0 ||
    state.subscribers.size > 0 ||
    state.pending.length > 0 ||
    state.leftovers
  ) {
    return;
  }
  if (hasHistory()) window.removeEventListener("popstate", onPopState);
  state.listening = false;
};

const settleIfIdle = (): void => {
  if (state.pending.length > 0) return;
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  for (const entry of state.deferred.splice(0)) pushEntry(entry);
  for (const resolve of state.waiters.splice(0)) resolve();
};

const traverse = (delta: -1 | 1, kind: TraversalKind): void => {
  state.pending.push(kind);
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = null;
    state.pending.length = 0;
    settleIfIdle();
    maybeTeardownListener();
  }, SETTLE_TIMEOUT_MS);
  ensureListener();
  const moved = runInternal(() => {
    if (delta < 0) history.back();
    else history.forward();
  });
  if (!moved) {
    state.pending.pop();
    settleIfIdle();
  }
};

const newStackId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const startStack = (): void => {
  state.stackId = newStackId();
  const current = history.state;
  const leftover = plain(current);
  state.baseUrl =
    isMarker(leftover) && leftover?.[ROUTED] !== undefined
      ? undefined
      : location.href;
  if (isMarker(leftover)) return;
  if (current !== null && current !== undefined && !leftover) return;
  runInternal(() => {
    history.replaceState(
      { ...foreignKeys(current), [STACK]: state.stackId, [DEPTH]: 0 },
      "",
      location.href,
    );
  });
};

function pushEntry(entry: Entry): boolean {
  const depth = state.live.length + 1;
  if (state.live.length === 0) startStack();
  const written = runInternal(() => {
    history.pushState(markerFor(entry.surface, depth), "", entry.surface.url);
  });
  if (!written) return false;
  state.live.push(entry);
  state.position = depth;
  state.knownLength = history.length;
  state.href = location.href;
  ensureListener();
  return true;
}

const enlist = (entry: Entry): void => {
  if (state.pending.length > 0) state.deferred.push(entry);
  else pushEntry(entry);
};

const sameBrand = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean => {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key.startsWith(MARKER) && a[key] !== b[key]) return false;
  }
  return true;
};

const rebrand = (depth: number): void => {
  const entry = state.live[depth - 1];
  if (!entry) return;
  const url = urlForDepth(depth);
  const marker = markerFor(entry.surface, depth);
  const atUrl =
    url === undefined || new URL(url, location.href).href === location.href;
  if (atUrl && sameBrand(plain(history.state) ?? {}, marker)) return;
  runInternal(() => {
    history.replaceState(marker, "", url);
  });
  state.href = location.href;
};

const closeAbove = (depth: number): void => {
  const dropped = state.live.splice(depth);
  for (let i = dropped.length - 1; i >= 0; i -= 1) {
    const entry = dropped[i]!;
    let closing: Promise<void> | void = undefined;
    try {
      closing = entry.surface.close();
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
    void Promise.resolve(closing).then(() => {
      if (!entry.surface.isOpen()) return;
      const known = (e: Entry): boolean => e.surface === entry.surface;
      if (state.live.some(known) || state.deferred.some(known)) return;
      enlist(entry);
    });
  }
};

function onPopState(event: PopStateEvent): void {
  const kind = state.pending.shift();
  const byUser = kind !== "pop";
  const landed = plain(event.state);
  const depth = depthOf(landed);
  const from = state.position;
  const liveBefore = state.live.length;
  const grew = history.length > state.knownLength;
  state.knownLength = history.length;
  const within = inStack(landed);

  if (within && depth !== null) {
    state.position = depth;
    if (depth > state.live.length) {
      const forward = from !== null && from < depth;
      traverse(forward ? 1 : -1, byUser ? "skip" : "pop");
    } else if (depth < state.live.length) {
      if (byUser) closeAbove(depth);
    } else {
      rebrand(depth);
    }
  } else if (isMarker(landed)) {
    state.position = null;
    traverse(-1, byUser ? "skip" : "pop");
  } else {
    state.position = null;
    if (byUser && !grew && state.live.length > 0) {
      closeAbove(state.live.length - 1);
    }
  }

  const moved = location.href !== state.href;
  state.href = location.href;
  if (kind === undefined && moved && (liveBefore === 0 || !within)) {
    notifyRouteChange();
  }
  settleIfIdle();
  maybeTeardownListener();
}

export function pushBackMarker(surface: BackSurface): MarkerHandle {
  const entry: Entry = { surface };
  if (hasHistory()) enlist(entry);
  return entry as unknown as MarkerHandle;
}

export function popBackMarker(handle: MarkerHandle): Promise<void> {
  if (!hasHistory()) return Promise.resolve();
  const entry = handle as unknown as Entry;
  const waiting = state.deferred.indexOf(entry);
  if (waiting !== -1) state.deferred.splice(waiting, 1);
  const idx = state.live.indexOf(entry);
  if (idx === -1) return historySettled();
  const top = state.live.length;
  state.live.splice(idx, 1);
  const current = plain(history.state);
  const onTop =
    isMarker(current) && inStack(current) && depthOf(current) === top;
  if (onTop && state.pending.length === 0) {
    traverse(-1, "pop");
  } else {
    state.leftovers = true;
    ensureListener();
  }
  maybeTeardownListener();
  return historySettled();
}

export function releaseOrphanMarker(): void {
  if (!hasHistory() || state.orphanChecked) return;
  state.orphanChecked = true;
  if (state.live.length > 0 || state.pending.length > 0) return;
  if (!isMarker(plain(history.state))) return;
  state.leftovers = true;
  traverse(-1, "pop");
}

export function historySettled(): Promise<void> {
  if (state.pending.length === 0) return Promise.resolve();
  return new Promise(resolve => {
    state.waiters.push(resolve);
  });
}

const wrap = (original: HistoryFn): HistoryFn =>
  function (this: History, ...args: Parameters<HistoryFn>): void {
    original.apply(this, args);
    state.knownLength = history.length;
    if (location.href === state.href) return;
    state.href = location.href;
    if (state.internal === 0 && state.subscribers.size > 0) {
      notifyRouteChange();
    }
  } as HistoryFn;

const installPatch = (): void => {
  if (!state.push || history.pushState === state.push.original) {
    const original = history.pushState;
    const wrapper = wrap(original);
    history.pushState = wrapper;
    state.push = { wrapper, original };
  }
  if (!state.replace || history.replaceState === state.replace.original) {
    const original = history.replaceState;
    const wrapper = wrap(original);
    history.replaceState = wrapper;
    state.replace = { wrapper, original };
  }
};

const removePatch = (): void => {
  if (state.push && history.pushState === state.push.wrapper) {
    history.pushState = state.push.original;
    state.push = null;
  }
  if (state.replace && history.replaceState === state.replace.wrapper) {
    history.replaceState = state.replace.original;
    state.replace = null;
  }
};

export function subscribeRouteChange(fn: () => void): () => void {
  if (!hasHistory()) return () => {};
  state.subscribers.add(fn);
  state.href = location.href;
  state.knownLength = history.length;
  installPatch();
  ensureListener();
  return () => {
    if (!state.subscribers.delete(fn)) return;
    if (state.subscribers.size === 0) removePatch();
    maybeTeardownListener();
  };
}

export const __resetHistoryCoordinatorForTests = (): void => {
  state.live.length = 0;
  state.stackId = undefined;
  state.baseUrl = undefined;
  state.position = null;
  state.knownLength = 0;
  state.href = "";
  state.internal = 0;
  state.pending.length = 0;
  state.deferred.length = 0;
  state.leftovers = false;
  state.orphanChecked = false;
  state.subscribers.clear();
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = null;
  for (const resolve of state.waiters.splice(0)) resolve();
  if (hasHistory()) {
    if (state.push && history.pushState === state.push.wrapper) {
      history.pushState = state.push.original;
    }
    if (state.replace && history.replaceState === state.replace.wrapper) {
      history.replaceState = state.replace.original;
    }
    if (state.listening) window.removeEventListener("popstate", onPopState);
  }
  state.push = null;
  state.replace = null;
  state.listening = false;
};
