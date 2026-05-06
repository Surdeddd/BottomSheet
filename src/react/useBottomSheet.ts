import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type { EngineOptions, EngineState, SnapPointDef } from "../core/types";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type UseBottomSheetRefs = {
  sheetRef: React.RefObject<HTMLElement | null>;
  handleRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
  backdropRef: React.RefObject<HTMLElement | null>;
  screenRef: React.RefObject<HTMLElement | null>;
};

/**
 * Return shape of `useBottomSheet`. Optionally narrows to a literal-id union
 * `TId` when the consumer explicitly types the call site:
 *
 * ```ts
 * const sheet = useBottomSheet<"min" | "full">({ snapPoints: [...] });
 * sheet.snapTo("min"); // ✓
 * ```
 *
 * Without an explicit type argument `TId` defaults to `string`.
 */
export type UseBottomSheetReturn<TId extends string = string> =
  UseBottomSheetRefs & {
    state: EngineState & { activeId: TId };
    snapTo: (id: TId) => Promise<void>;
    open: (id?: TId) => Promise<void>;
    close: () => Promise<void>;
    setAllowed: (ids: TId[], snap?: TId) => void;
    /**
     * @deprecated React Strict Mode double-invokes the layout effect — the
     * effect tears down (engineRef.current = null), the next render reads
     * this field as `null` for one frame, and only the second mount restores
     * a live engine. Consumers calling methods through this field during that
     * window get `null`. Use `getEngine()` instead — it lazy-reads the live
     * ref and is safe across Strict Mode and across resize/setSnapPoints
     * paths that don't fire React-tracked events. Will be removed in v2.
     */
    engine: BottomSheetEngine | null;
    /** Lazy accessor — always reads the live engine, even after external
     * mutations (resize, setSnapPoints) that don't fire React-tracked events.
     * Strict-Mode-safe: returns the current ref at call time, not a stale
     * snapshot from the last commit. */
    getEngine: () => BottomSheetEngine | null;
  };

const SSR_STATE: EngineState = Object.freeze({
  size: 0,
  activeId: "",
  isDragging: false,
  isAnimating: false,
  progress: 0,
});

/**
 * Headless React hook. Wires the engine to refs and subscribes to its events
 * via `useSyncExternalStore` for tear-free state in concurrent mode.
 *
 * The snapshot is cached in a ref and only refreshed when a notify fires,
 * so React's identity check doesn't trigger an infinite loop (the engine's
 * `state` getter constructs a fresh object every call).
 */
type HookOpts<TId extends string> = Omit<
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

export function useBottomSheet<TId extends string = string>(
  opts: HookOpts<TId>,
): UseBottomSheetReturn<TId> {
  const sheetRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  const engineRef = useRef<BottomSheetEngine | null>(null);
  const subscribersRef = useRef<Set<() => void>>(new Set());
  const cachedSnapshotRef = useRef<EngineState>(SSR_STATE);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [, setMounted] = useState(0);

  useIsomorphicLayoutEffect(() => {
    if (!sheetRef.current) return;
    const current = optsRef.current as Omit<
      EngineOptions,
      "element" | "handle" | "scrollContainer" | "backdrop" | "screenComponent"
    >;
    const engine = new BottomSheetEngine({
      ...current,
      element: sheetRef.current,
      handle: handleRef.current ?? undefined,
      scrollContainer: contentRef.current ?? undefined,
      backdrop: backdropRef.current ?? undefined,
      screenComponent: screenRef.current ?? undefined,
    });
    engineRef.current = engine;
    cachedSnapshotRef.current = { ...engine.state };
    setMounted(n => n + 1);

    // Settled-state-only sync: drag/progress are 60fps and would flood React
    // with re-renders. Subscribe to those imperatively via `engine.on(...)`.
    const refresh = () => {
      cachedSnapshotRef.current = { ...engine.state };
      subscribersRef.current.forEach(fn => fn());
    };
    const offs = [
      engine.on("snap", payload => {
        refresh();
        optsRef.current.onSnap?.(payload.id as TId);
      }),
      engine.on("dragstart", refresh),
      engine.on("dragend", refresh),
    ];
    return () => {
      offs.forEach(off => off());
      engine.destroy();
      engineRef.current = null;
      cachedSnapshotRef.current = SSR_STATE;
      setMounted(n => n + 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NUL separator so ids containing any printable character cannot collide.
  const allowedKey = (opts.allowed ?? opts.snapPoints.map(p => p.id)).join(
    "\x00",
  );
  const snapKey = opts.snapPoints.map(p => p.id).join("\x00");
  useEffect(() => {
    if (!engineRef.current) return;
    const ids: string[] = opts.allowed
      ? Array.from(opts.allowed as ReadonlyArray<string>)
      : opts.snapPoints.map(p => p.id);
    engineRef.current.setAllowed(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey, snapKey]);

  const subscribe = useCallback((fn: () => void) => {
    subscribersRef.current.add(fn);
    return () => subscribersRef.current.delete(fn);
  }, []);

  const getSnapshot = useCallback(
    (): EngineState => cachedSnapshotRef.current,
    [],
  );
  const getServerSnapshot = useCallback((): EngineState => SSR_STATE, []);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const snapTo = useCallback(
    (id: string) => engineRef.current?.snapTo(id) ?? Promise.resolve(),
    [],
  );
  const open = useCallback(
    (id?: string) => engineRef.current?.open(id) ?? Promise.resolve(),
    [],
  );
  const close = useCallback(
    () => engineRef.current?.close() ?? Promise.resolve(),
    [],
  );
  const setAllowed = useCallback((ids: string[], snap?: string) => {
    engineRef.current?.setAllowed(ids, snap);
  }, []);

  const getEngine = useCallback(() => engineRef.current, []);

  return useMemo(
    () =>
      ({
        sheetRef,
        handleRef,
        contentRef,
        backdropRef,
        screenRef,
        state,
        snapTo,
        open,
        close,
        setAllowed,
        engine: engineRef.current,
        getEngine,
      }) as unknown as UseBottomSheetReturn<TId>,
    [state, snapTo, open, close, setAllowed, getEngine],
  );
}
