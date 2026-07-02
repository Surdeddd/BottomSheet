import type { SheetEventMap } from "../types";

type RouteEngine = {
  on<K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ): () => void;
};

export type RouteDeps = {
  routedTo: string | undefined;
  closeOnBack: boolean;
  isTopSheet: () => boolean;
  getSize: () => number;
  isDestroyed: () => boolean;
  close: () => Promise<void>;
  on: RouteEngine["on"];
  sheetId: string;
};

type BackCloser = {
  isOpen: () => boolean;
  isTop: () => boolean;
  close: () => Promise<void> | void;
  restore: () => void;
  consumed: boolean;
};

const closers: BackCloser[] = [];
let handlerInstalled = false;
let suppress = 0;

const ensureHandler = (): void => {
  if (handlerInstalled || typeof window === "undefined") return;
  handlerInstalled = true;
  window.addEventListener("popstate", () => {
    if (suppress > 0) {
      suppress -= 1;
      return;
    }
    let target: BackCloser | null = null;
    for (let i = closers.length - 1; i >= 0; i -= 1) {
      const c = closers[i]!;
      if (!c.isOpen()) continue;
      if (!target) target = c;
      if (c.isTop()) {
        target = c;
        break;
      }
    }
    if (!target) return;
    target.consumed = true;
    const idx = closers.indexOf(target);
    if (idx !== -1) closers.splice(idx, 1);
    const settled = target;
    void Promise.resolve(settled.close()).then(() => {
      if (settled.isOpen()) settled.restore();
    });
  });
};

const programmaticBack = (): void => {
  suppress += 1;
  try {
    history.back();
  } catch {
    suppress = Math.max(0, suppress - 1);
  }
};

export function installRoute(deps: RouteDeps): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  if (!deps.routedTo && !deps.closeOnBack) {
    return () => {};
  }

  let pushed = false;
  let closer: BackCloser | null = null;

  const teardownEntry = (): void => {
    if (closer) {
      const idx = closers.indexOf(closer);
      if (idx !== -1) closers.splice(idx, 1);
    }
    const wasConsumed = closer?.consumed ?? false;
    closer = null;
    if (pushed && !wasConsumed) {
      pushed = false;
      programmaticBack();
    } else {
      pushed = false;
    }
  };

  const pushEntry = (): void => {
    try {
      if (deps.routedTo !== undefined) {
        history.pushState({ __bsRouted: deps.sheetId }, "", deps.routedTo);
      } else {
        history.pushState({ __bsSheet: deps.sheetId }, "");
      }
      pushed = true;
    } catch {
      pushed = false;
    }
  };

  const onOpen = (): void => {
    if (closer) return;
    const self: BackCloser = {
      isOpen: () => !deps.isDestroyed() && deps.getSize() > 0,
      isTop: () => deps.isTopSheet(),
      close: () => deps.close(),
      restore: () => {
        if (deps.isDestroyed() || closer !== self) return;
        self.consumed = false;
        if (!closers.includes(self)) closers.push(self);
        pushEntry();
      },
      consumed: false,
    };
    closer = self;
    ensureHandler();
    closers.push(self);
    pushEntry();
  };

  const unsubscribeOpen = deps.on("open", onOpen);
  const unsubscribeClose = deps.on("close", teardownEntry);
  if (deps.getSize() > 0) onOpen();

  return () => {
    unsubscribeOpen();
    unsubscribeClose();
    teardownEntry();
  };
}

export const __resetRouteCoordinatorForTests = (): void => {
  closers.length = 0;
  suppress = 0;
};

export type RouteChangeDeps = {
  isDestroyed: () => boolean;
  getSize: () => number;
  close: () => Promise<void>;
};

export function installRouteChange(deps: RouteChangeDeps): () => void {
  if (typeof window === "undefined" || typeof history === "undefined") {
    return () => {};
  }
  const onChange = (): void => {
    if (deps.isDestroyed() || deps.getSize() <= 0) return;
    void deps.close();
  };
  const wrap = (
    key: "pushState" | "replaceState",
  ): (() => void) => {
    const original = history[key];
    const patched = function (
      this: History,
      ...args: Parameters<History["pushState"]>
    ): void {
      original.apply(this, args);
      onChange();
    };
    (history as unknown as Record<string, unknown>)[key] = patched;
    return () => {
      if ((history as unknown as Record<string, unknown>)[key] === patched) {
        (history as unknown as Record<string, unknown>)[key] = original;
      }
    };
  };
  window.addEventListener("popstate", onChange);
  const restorePush = wrap("pushState");
  const restoreReplace = wrap("replaceState");
  return () => {
    window.removeEventListener("popstate", onChange);
    restorePush();
    restoreReplace();
  };
}
