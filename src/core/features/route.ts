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

export function installRoute(deps: RouteDeps): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  if (!deps.routedTo && !deps.closeOnBack) {
    return () => {};
  }

  // Both flags are true only between our own `history.pushState` and the
  // matching `history.back()`. They guard against double-back when the
  // consumer also wires their own router on top, and against issuing a
  // redundant pop when the browser has already popped our entry.
  let routePushed = false;
  let closeOnBackPushed = false;
  let detachPopstate: (() => void) | null = null;

  const popOurMarker = (key: string, expected: unknown): void => {
    const state = history.state as Record<string, unknown> | null;
    if (state && state[key] === expected) {
      try {
        history.back();
      } catch {
        /* sandboxed iframe or detached frame */
      }
    }
  };

  const onOpen = (): void => {
    // routedTo wins over closeOnBack — both would require two back-presses.
    if (deps.routedTo && !detachPopstate) {
      const target = deps.routedTo;
      try {
        history.pushState({ __bsRouted: target }, "", target);
        routePushed = true;
      } catch {
        /* SecurityError: cross-origin URL or sandboxed iframe */
      }
      const onPop = (event: PopStateEvent): void => {
        if (deps.isDestroyed()) return;
        // Only react when the popped state is OUR routed entry; an
        // unrelated history pop (consumer back nav) shouldn't close the sheet.
        const state = event.state as Record<string, unknown> | null;
        if (
          state &&
          state.__bsRouted === target &&
          deps.getSize() > 0
        ) {
          routePushed = false;
          void deps.close();
        }
      };
      window.addEventListener("popstate", onPop);
      detachPopstate = () => window.removeEventListener("popstate", onPop);
    } else if (deps.closeOnBack && !detachPopstate) {
      try {
        history.pushState({ __bsSheet: deps.sheetId }, "");
        closeOnBackPushed = true;
      } catch {
        /* sandboxed iframe */
      }
      const onPop = (): void => {
        if (deps.isDestroyed()) return;
        if (deps.getSize() > 0 && deps.isTopSheet()) {
          const state = history.state as Record<string, unknown> | null;
          if (state?.__bsSheet !== deps.sheetId) closeOnBackPushed = false;
          void deps.close();
        }
      };
      window.addEventListener("popstate", onPop);
      detachPopstate = () => window.removeEventListener("popstate", onPop);
    }
  };

  const onClose = (): void => {
    detachPopstate?.();
    detachPopstate = null;
    if (routePushed) {
      routePushed = false;
      if (deps.routedTo !== undefined) popOurMarker("__bsRouted", deps.routedTo);
    }
    if (closeOnBackPushed) {
      closeOnBackPushed = false;
      popOurMarker("__bsSheet", deps.sheetId);
    }
  };

  const unsubscribeOpen = deps.on("open", onOpen);
  const unsubscribeClose = deps.on("close", onClose);
  // If sheet is already open at install time (e.g. SSR-restored state),
  // run the open path now so the back-button handler is registered.
  if (deps.getSize() > 0) onOpen();

  return () => {
    unsubscribeOpen();
    unsubscribeClose();
    detachPopstate?.();
    detachPopstate = null;
    if (routePushed) {
      routePushed = false;
      if (deps.routedTo !== undefined) popOurMarker("__bsRouted", deps.routedTo);
    }
    if (closeOnBackPushed) {
      closeOnBackPushed = false;
      popOurMarker("__bsSheet", deps.sheetId);
    }
  };
}
