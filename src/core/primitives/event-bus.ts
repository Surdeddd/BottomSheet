/**
 * Generic typed listener registry shared by `BottomSheetEngine` and `OverlayEngine`.
 * Listeners are stored in a `Set` so duplicate `on(event, fn)` calls with the
 * same `fn` are idempotent.
 * @internal
 */
export type EventBus<Map extends Record<string, unknown>> = {
  on: <K extends keyof Map>(
    event: K,
    fn: (payload: Map[K]) => void,
  ) => () => void;
  emit: <K extends keyof Map>(event: K, payload: Map[K]) => void;
  /** Number of listeners for a given event — used by the engine to gate
   *  per-frame `progress` / `drag` payload allocation when nobody's listening. */
  listenerCount: <K extends keyof Map>(event: K) => number;
  /** Drop every listener. Called from engine.destroy(). */
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
      // Copy-on-emit guard: a listener that calls `off()` for itself (or a
      // sibling) would mutate `set` mid-iteration. Cloning is cheap at the
      // ≤10-listener scale this fan-out runs at.
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
