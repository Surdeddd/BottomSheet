import type { SheetEventMap } from "../types";
import {
  pushBackMarker,
  popBackMarker,
  releaseOrphanMarker,
  subscribeRouteChange,
  __resetHistoryCoordinatorForTests,
  type BackSurface,
  type MarkerHandle,
} from "./history-coordinator";

type RouteEngine = {
  on<K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ): () => void;
};

export type RouteDeps = {
  routedTo: string | undefined;
  closeOnBack: boolean;
  isOpen: () => boolean;
  isDestroyed: () => boolean;
  close: () => Promise<void>;
  hold: (settled: Promise<void>) => void;
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

  let handle: MarkerHandle | null = null;
  const surface: BackSurface = {
    isOpen: () => !deps.isDestroyed() && deps.isOpen(),
    close: deps.close,
    markerState: () =>
      deps.routedTo !== undefined
        ? { __bsRouted: deps.sheetId }
        : { __bsSheet: deps.sheetId },
    url: deps.routedTo,
  };

  const onOpen = (): void => {
    if (handle) return;
    handle = pushBackMarker(surface);
  };

  const onClose = (): void => {
    if (!handle) return;
    deps.hold(popBackMarker(handle));
    handle = null;
  };

  const unsubscribeOpen = deps.on("open", onOpen);
  const unsubscribeClose = deps.on("close", onClose);
  if (deps.isOpen()) onOpen();
  else releaseOrphanMarker();

  return () => {
    unsubscribeOpen();
    unsubscribeClose();
    if (handle) {
      void popBackMarker(handle);
      handle = null;
    }
  };
}

export const __resetRouteCoordinatorForTests = (): void => {
  __resetHistoryCoordinatorForTests();
};

export type RouteChangeDeps = {
  isDestroyed: () => boolean;
  isOpen: () => boolean;
  close: () => Promise<void>;
};

export function installRouteChange(deps: RouteChangeDeps): () => void {
  return subscribeRouteChange(() => {
    if (deps.isDestroyed() || !deps.isOpen()) return;
    void deps.close();
  });
}
