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
    const active = deps.resolveSnap(deps.getActiveId());
    if (!active || active.size === 0) return;
    let target: { id: string; size: number } | null = null;
    for (const id of deps.getAllowedIds()) {
      const snap = deps.resolveSnap(id);
      if (!snap || snap.size <= 0) continue;
      if (!target || snap.size < target.size) target = snap;
    }
    if (!target) return;
    if (target.id === active.id || target.size >= active.size) return;
    deps.snapTo(target.id);
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
  if ((deps.resolveSnap(deps.getActiveId())?.size ?? 0) > 0) reset();

  return () => {
    clearTimer();
    unsubscribe();
  };
}
