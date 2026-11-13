const STORE_KEY = Symbol.for("@surdeddd/bottom-sheet/shared/1");

type Store = Record<string, unknown>;

export function shared<T>(name: string, init: () => T): T {
  const host = globalThis as unknown as Record<symbol, Store | undefined>;
  const store = (host[STORE_KEY] ??= {});
  if (!(name in store)) store[name] = init();
  return store[name] as T;
}
