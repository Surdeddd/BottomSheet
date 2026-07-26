import type { EngineOptions } from "../types";

export type SheetConfig<Key extends string = string> = Partial<
  Omit<EngineOptions, "element" | "handle" | "scrollContainer" | "backdrop">
> & {
  key?: Key;
  onOpen?: (key: Key) => void;
  onClose?: (key: Key) => void;
};

export type SheetManager<Key extends string = string> = {
  register(key: Key, config: SheetConfig<Key>): void;
  unregister(key: Key): void;
  resolve(key: Key): SheetConfig<Key> | null;
  keys(): Key[];
  transition(prev: Key | null, next: Key | null): void;
};

export const createSheetManager = <Key extends string = string>(
  initial: Record<Key, SheetConfig<Key>> = {} as Record<Key, SheetConfig<Key>>,
): SheetManager<Key> => {
  const registry = new Map<Key, SheetConfig<Key>>();
  for (const [key, config] of Object.entries(initial) as [Key, SheetConfig<Key>][]) {
    registry.set(key, { ...config, key });
  }

  return {
    register(key, config) {
      registry.set(key, { ...config, key });
    },
    unregister(key) {
      registry.delete(key);
    },
    resolve(key) {
      return registry.get(key) ?? null;
    },
    keys() {
      return Array.from(registry.keys());
    },
    transition(prev, next) {
      if (prev) registry.get(prev)?.onClose?.(prev);
      if (next) registry.get(next)?.onOpen?.(next);
    },
  };
};
