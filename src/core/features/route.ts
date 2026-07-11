import type { SheetEventMap } from "../types";
import {
  pushBackMarker,
  popBackMarker,
  subscribeRouteChange,
  __resetHistoryCoordinatorForTests,
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

  let handle: MarkerHandle | null = null;

  const onOpen = (): void => {
    if (handle) return;
    handle = pushBackMarker({
      isOpen: () => !deps.isDestroyed() && deps.getSize() > 0,
      isTop: deps.isTopSheet,
      close: deps.close,
      markerState: () =>
        deps.routedTo !== undefined
          ? { __bsRouted: deps.sheetId }
          : { __bsSheet: deps.sheetId },
      url: deps.routedTo,
    });
  };

  const onClose = (): void => {
    if (!handle) return;
    popBackMarker(handle);
    handle = null;
  };

  const unsubscribeOpen = deps.on("open", onOpen);
  const unsubscribeClose = deps.on("close", onClose);
  if (deps.getSize() > 0) onOpen();

  return () => {
    unsubscribeOpen();
    unsubscribeClose();
    if (handle) {
      popBackMarker(handle);
      handle = null;
    }
  };
}

export const __resetRouteCoordinatorForTests = (): void => {
  __resetHistoryCoordinatorForTests();
};

export type RouteChangeDeps = {
  isDestroyed: () => boolean;
  getSize: () => number;
  close: () => Promise<void>;
};

export function installRouteChange(deps: RouteChangeDeps): () => void {
  return subscribeRouteChange(() => {
    if (deps.isDestroyed() || deps.getSize() <= 0) return;
    void deps.close();
  });
}
