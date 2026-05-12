import type { SheetEventMap } from "../types";

export type AutoCollapseEngine = {
  on<K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ): () => void;
};

export type AutoCollapseDeps = {
  ms: number | undefined;
  isDestroyed: () => boolean;
  isDragging: () => boolean;
  getAllowedIds: () => string[];
  getActiveId: () => string;
  resolveSnap: (id: string) => { id: string; size: number } | null;
  snapTo: (id: string) => void;
  on: AutoCollapseEngine["on"];
};

export function installAutoCollapse(deps: AutoCollapseDeps): () => void {
  const { ms } = deps;
  if (ms === undefined || ms <= 0) {
    return () => {};
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const fire = (): void => {
    if (deps.isDestroyed()) return;
    if (deps.isDragging()) return;
    const allowed = deps.getAllowedIds();
    const target = allowed.find(id => {
      const snap = deps.resolveSnap(id);
      return snap !== null && snap.size > 0;
    });
    if (!target) return;
    if (target === deps.getActiveId()) return;
    deps.snapTo(target);
  };

  const reset = (): void => {
    clearTimer();
    if (deps.isDestroyed()) return;
    timer = setTimeout(() => {
      timer = null;
      fire();
    }, ms);
  };

  const unsubscribe = deps.on("snap", () => reset());

  return () => {
    clearTimer();
    unsubscribe();
  };
}
