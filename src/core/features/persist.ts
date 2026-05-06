import type { SheetEventMap } from "../types";

export type PersistEngine = {
  on<K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ): () => void;
};

/**
 * Read the persisted snap id from `localStorage[key]`. Returns `null` if
 * persistence is disabled, the env doesn't ship `localStorage` (SSR / Node),
 * or the call throws (Safari private mode, storage quotas, security errors).
 *
 * Must be invoked synchronously during engine construction so the restored
 * id can influence the initial `activeId` before `applySize` runs.
 */
export function readPersistedId(key: string | undefined): string | null {
  if (!key) return null;
  if (typeof window === "undefined") return null;
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Subscribe to the `snap` event and persist the active snap id under `key`.
 * Returns a teardown function that unsubscribes the listener. The engine
 * captures the teardown into its `TeardownStack`, so destroy() drains it
 * LIFO with shared per-fn error isolation.
 *
 * Never deletes the entry on teardown — clearing persisted state is a
 * consumer-lifecycle concern (logout, settings reset), not an engine concern.
 */
export function installPersist(
  engine: PersistEngine,
  key: string,
): () => void {
  const unsubscribe = engine.on("snap", ({ id }) => {
    if (typeof window === "undefined") return;
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(key, id);
    } catch {
      /* private mode / quota / security error — silently degrade */
    }
  });
  return unsubscribe;
}
