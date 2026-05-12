import type { SheetEventMap } from "../types";

export type PersistEngine = {
  on<K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ): () => void;
};

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
    }
  });
  return unsubscribe;
}
