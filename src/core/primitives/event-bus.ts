export type EventBus<Map extends Record<string, unknown>> = {
  on: <K extends keyof Map>(
    event: K,
    fn: (payload: Map[K]) => void,
  ) => () => void;
  emit: <K extends keyof Map>(event: K, payload: Map[K]) => void;

  listenerCount: <K extends keyof Map>(event: K) => number;

  clear: () => void;
};

export function createEventBus<
  Map extends Record<string, unknown>,
>(): EventBus<Map> {
  const listeners = new Map<keyof Map, Set<(payload: unknown) => void>>();

  return {
    on(event, fn) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(fn as (payload: unknown) => void);
      return () => {
        set!.delete(fn as (payload: unknown) => void);
      };
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;

      for (const fn of [...set]) {
        (fn as (payload: Map[typeof event]) => void)(payload);
      }
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    },
    clear() {
      listeners.clear();
    },
  };
}
