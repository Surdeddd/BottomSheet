import type { EngineOptions } from "../types";

/**
 * Route-based / context-based sheet config registry. Caller maps a key
 * (route name, screen id, modal kind, anything) to a partial engine config;
 * `manager.resolve(key)` returns the merged options ready to feed into
 * `BottomSheetEngine` or any adapter.
 *
 * Lifecycle hooks (`onOpen`, `onClose`) are stored alongside the config so
 * the consumer can attach them via `engine.on(...)` without ceremony.
 *
 *   const manager = createSheetManager({
 *     home:   { snapPoints: [...], allowed: ["min","half","full"], onOpen: load },
 *     marker: { snapPoints: [...], allowed: ["half","full"],       onOpen: focus },
 *   });
 *   manager.resolve("home"); // → { snapPoints, allowed, onOpen, onClose }
 */
export type SheetConfig<Key extends string = string> = Partial<
  Omit<EngineOptions, "element" | "handle" | "scrollContainer" | "backdrop">
> & {
  /** Logical key (route name, modal kind, ...) — useful for telemetry. */
  key?: Key;
  onOpen?: (key: Key) => void;
  onClose?: (key: Key) => void;
};

export type SheetManager<Key extends string = string> = {
  /** Register or replace a config. */
  register(key: Key, config: SheetConfig<Key>): void;
  /** Remove a registered config. */
  unregister(key: Key): void;
  /** Look up a config by key. Returns null if absent. */
  resolve(key: Key): SheetConfig<Key> | null;
  /** Get all registered keys. */
  keys(): Key[];
  /** Run `onClose(prev)` then `onOpen(next)` — for route transitions. */
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
