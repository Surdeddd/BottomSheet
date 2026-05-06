import { onBeforeUnmount, onMounted, reactive, ref, type Ref } from "vue";
import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type {
  EngineOptions,
  EngineState,
  SheetEventMap,
  SnapPointDef,
} from "../core/types";

/**
 * Composable options. Optionally narrows to a literal-id union `TId` when the
 * consumer pins the call site:
 *
 * ```ts
 * useBottomSheet<"min" | "full">({ snapPoints: [...] });
 * ```
 *
 * Without an explicit type argument `TId` defaults to `string` so existing
 * call sites compile unchanged. Mirrors the React hook's contract.
 */
export type UseBottomSheetVueOptions<TId extends string = string> = Omit<
  EngineOptions,
  | "element"
  | "handle"
  | "scrollContainer"
  | "backdrop"
  | "screenComponent"
  | "snapPoints"
  | "allowed"
  | "initial"
> & {
  snapPoints: SnapPointDef<TId>[] | ReadonlyArray<SnapPointDef<TId>>;
  allowed?: TId[] | ReadonlyArray<TId>;
  initial?: TId;
  /** Called after a snap commit settles. Mirrors the engine's `snap` event. */
  onSnap?: (id: TId) => void;
};

export type UseBottomSheetVueReturn<TId extends string = string> = {
  sheetRef: Ref<HTMLElement | null>;
  handleRef: Ref<HTMLElement | null>;
  contentRef: Ref<HTMLElement | null>;
  backdropRef: Ref<HTMLElement | null>;
  screenRef: Ref<HTMLElement | null>;
  state: EngineState & { activeId: TId };
  snapTo: (id: TId) => Promise<void>;
  open: (id?: TId) => Promise<void>;
  close: () => Promise<void>;
  /** Replace the runtime allow-list. */
  setAllowed: (ids: TId[], snap?: TId) => void;
  /** Replace the runtime snap-point list (and optionally allow-list). Use to
   *  apply config that changes after mount — Vue composable mirrors React's
   *  one-shot construction model and does NOT auto-react to changes in `opts`. */
  setSnapPoints: (
    points: EngineOptions["snapPoints"],
    allowed?: string[],
  ) => void;
  /** Subscribe to any engine event (e.g. `before-snap`, `progress`, `drag`).
   *  Returns an unsubscribe function. Listeners registered before mount are
   *  queued and replayed onto the engine on `onMounted`. Necessary because
   *  the composable doesn't expose the engine instance directly. */
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
};

/**
 * Vue 3 composable wrapping the headless engine. Returns refs to attach to
 * your own template; mirrors the React hook's contract.
 *
 * **One-shot construction.** `opts` is read at mount and never re-watched —
 * if you need to apply runtime changes (e.g. switch `mode`, swap `allowed`,
 * replace `snapPoints`), call the returned `setAllowed` / `setSnapPoints`
 * methods. This matches React's `useBottomSheet` and avoids the foot-gun
 * where a `watch(() => opts.allowed, ...)` silently no-ops when callers pass
 * a non-reactive `opts` object.
 */
export function useBottomSheet<TId extends string = string>(
  opts: UseBottomSheetVueOptions<TId>,
): UseBottomSheetVueReturn<TId> {
  const sheetRef = ref<HTMLElement | null>(null);
  const handleRef = ref<HTMLElement | null>(null);
  const contentRef = ref<HTMLElement | null>(null);
  const backdropRef = ref<HTMLElement | null>(null);
  const screenRef = ref<HTMLElement | null>(null);
  let engine: BottomSheetEngine | null = null;
  // Pre-mount listeners — replayed onto the engine on mount, since Vue's
  // composable invocation runs in setup() before the host element exists.
  // Track engine-side unsub on each pending entry so post-drain `unsub()`
  // closures can correctly remove from the engine, not just from the
  // (now-empty) pending array.
  type PendingEntry = {
    event: keyof SheetEventMap;
    fn: (p: unknown) => void;
    engineUnsub: (() => void) | null;
  };
  const pending: PendingEntry[] = [];

  const state = reactive<EngineState>({
    size: 0,
    activeId: opts.initial ?? opts.snapPoints[0]?.id ?? "default",
    isDragging: false,
    isAnimating: false,
    progress: 0,
  });

  const sync = (): void => {
    if (!engine) return;
    Object.assign(state, engine.state);
  };

  onMounted(() => {
    if (!sheetRef.value) return;
    // Strip onSnap before forwarding — engine doesn't recognise the field.
    const { onSnap, ...engineOpts } = opts;
    engine = new BottomSheetEngine({
      ...(engineOpts as Omit<
        EngineOptions,
        "element" | "handle" | "scrollContainer" | "backdrop" | "screenComponent"
      >),
      element: sheetRef.value,
      handle: handleRef.value ?? undefined,
      scrollContainer: contentRef.value ?? undefined,
      backdrop: backdropRef.value ?? undefined,
      screenComponent: screenRef.value ?? undefined,
    });
    sync();
    // Settled-state only: drag/progress are 60fps. For continuous progress,
    // consumers should subscribe via the returned `on()` method.
    engine.on("snap", payload => {
      sync();
      onSnap?.(payload.id as TId);
    });
    engine.on("dragstart", sync);
    engine.on("dragend", sync);
    // Replay pre-mount listeners. Entry refs survive `pending.length = 0`
    // via the closures returned from on() — those closures read
    // `entry.engineUnsub` to perform the real removal post-drain.
    for (const entry of pending) {
      entry.engineUnsub = engine.on(
        entry.event,
        entry.fn as (payload: SheetEventMap[typeof entry.event]) => void,
      );
    }
    pending.length = 0;
  });

  onBeforeUnmount(() => {
    engine?.destroy();
    engine = null;
  });

  return {
    sheetRef,
    handleRef,
    contentRef,
    backdropRef,
    screenRef,
    state,
    snapTo: (id: TId) => engine?.snapTo(id) ?? Promise.resolve(),
    open: (id?: TId) => engine?.open(id) ?? Promise.resolve(),
    close: () => engine?.close() ?? Promise.resolve(),
    setAllowed: (ids: TId[], snap?: TId) =>
      engine?.setAllowed(ids as unknown as string[], snap),
    setSnapPoints: (
      points: EngineOptions["snapPoints"],
      allowed?: string[],
    ) => engine?.setSnapPoints(points, allowed),
    on: <K extends keyof SheetEventMap>(
      event: K,
      fn: (payload: SheetEventMap[K]) => void,
    ): (() => void) => {
      if (engine) return engine.on(event, fn);
      const entry: PendingEntry = {
        event,
        fn: fn as (p: unknown) => void,
        engineUnsub: null,
      };
      pending.push(entry);
      return () => {
        if (entry.engineUnsub) {
          entry.engineUnsub();
          entry.engineUnsub = null;
        } else {
          const idx = pending.indexOf(entry);
          if (idx !== -1) pending.splice(idx, 1);
        }
      };
    },
  } as unknown as UseBottomSheetVueReturn<TId>;
}
