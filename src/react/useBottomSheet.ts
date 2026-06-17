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
import {
  resolveTeleportTarget,
  teleportElements,
  type TeleportTarget,
} from "../core/features/teleport";
import type {
  CloseReason,
  EngineOptions,
  EngineState,
  SheetEventMap,
  SnapPointDef,
} from "../core/types";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type UseBottomSheetRefs = {
  sheetRef: React.RefObject<HTMLElement | null>;
  handleRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
  backdropRef: React.RefObject<HTMLElement | null>;
  screenRef: React.RefObject<HTMLElement | null>;
};

export type UseBottomSheetReturn<TId extends string = string> =
  UseBottomSheetRefs & {
    state: EngineState & { activeId: TId };
    snapTo: (id: TId) => Promise<void>;
    open: (id?: TId) => Promise<void>;
    close: (reason?: CloseReason) => Promise<void>;
    expand: () => Promise<void>;
    collapse: () => Promise<void>;
    isTop: () => boolean;
    depth: () => number;
    setAllowed: (ids: TId[], snap?: TId) => void;
    addAnchor: (
      opts: import("../core/features/sheet-anchors").AnchorOptions,
    ) => () => void;
    setScrimStages: (
      opts: import("../core/features/scrim-stages").ScrimStagesOptions | null,
    ) => () => void;
    recompute: () => void;
    engine: BottomSheetEngine | null;
    getEngine: () => BottomSheetEngine | null;
  };

const SSR_STATE: EngineState = Object.freeze({
  size: 0,
  activeId: "",
  isDragging: false,
  isAnimating: false,
  progress: 0,
});

type HookOpts<TId extends string> = Omit<
  EngineOptions,
  | "element"
  | "handle"
  | "scrollContainer"
  | "backdrop"
  | "scrim"
  | "snapPoints"
  | "allowed"
  | "initial"
> & {
  snapPoints: SnapPointDef<TId>[] | ReadonlyArray<SnapPointDef<TId>>;
  allowed?: TId[] | ReadonlyArray<TId>;
  initial?: TId;
  teleportTo?: TeleportTarget;
  backdropColor?: string;
  backdropOpacity?: number;
  onSnap?: (id: TId) => void;
  onBeforeClose?: (payload: SheetEventMap["before-close"]) => void;
  onOpened?: (id: TId) => void;
  onClosed?: () => void;
  onDragStart?: (payload: SheetEventMap["dragstart"]) => void;
  onDragEnd?: (payload: SheetEventMap["dragend"]) => void;
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
      "element" | "handle" | "scrollContainer" | "backdrop" | "scrim"
    >;
    const engine = new BottomSheetEngine({
      ...current,
      element: sheetRef.current,
      handle: handleRef.current ?? undefined,
      scrollContainer: contentRef.current ?? undefined,
      backdrop: backdropRef.current ?? undefined,
      scrim: screenRef.current ?? undefined,
    });
    engineRef.current = engine;

    const target = resolveTeleportTarget(optsRef.current.teleportTo);
    const restoreTeleport = target
      ? teleportElements(
          [backdropRef.current, screenRef.current, sheetRef.current],
          target,
        )
      : null;

    if (optsRef.current.backdropColor !== undefined) {
      engine.setScrimColor(optsRef.current.backdropColor);
    }
    if (optsRef.current.backdropOpacity !== undefined) {
      engine.setBackdropRange([0, optsRef.current.backdropOpacity]);
    }

    cachedSnapshotRef.current = { ...engine.state };
    setMounted(n => n + 1);

    const refresh = () => {
      cachedSnapshotRef.current = { ...engine.state };
      subscribersRef.current.forEach(fn => fn());
    };
    const offs = [
      engine.on("snap", payload => {
        refresh();
        optsRef.current.onSnap?.(payload.id as TId);
      }),
      engine.on("before-close", payload => {
        optsRef.current.onBeforeClose?.(payload);
      }),
      engine.on("opened", payload => {
        optsRef.current.onOpened?.(payload.id as TId);
      }),
      engine.on("closed", () => {
        optsRef.current.onClosed?.();
      }),
      engine.on("dragstart", payload => {
        refresh();
        optsRef.current.onDragStart?.(payload);
      }),
      engine.on("dragend", payload => {
        refresh();
        optsRef.current.onDragEnd?.(payload);
      }),
    ];
    return () => {
      offs.forEach(off => off());
      restoreTeleport?.();
      engine.destroy();
      engineRef.current = null;
      cachedSnapshotRef.current = SSR_STATE;
      setMounted(n => n + 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    if (!engineRef.current) return;
    if (opts.backdropColor !== undefined) {
      engineRef.current.setScrimColor(opts.backdropColor);
    }
  }, [opts.backdropColor]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (opts.backdropOpacity !== undefined) {
      engineRef.current.setBackdropRange([0, opts.backdropOpacity]);
    }
  }, [opts.backdropOpacity]);

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
    (reason?: CloseReason) =>
      engineRef.current?.close(reason) ?? Promise.resolve(),
    [],
  );
  const expand = useCallback(
    () => engineRef.current?.expand() ?? Promise.resolve(),
    [],
  );
  const collapse = useCallback(
    () => engineRef.current?.collapse() ?? Promise.resolve(),
    [],
  );
  const isTop = useCallback(() => engineRef.current?.isTop() ?? false, []);
  const depth = useCallback(() => engineRef.current?.depth() ?? 0, []);
  const setAllowed = useCallback((ids: string[], snap?: string) => {
    engineRef.current?.setAllowed(ids, snap);
  }, []);

  const getEngine = useCallback(() => engineRef.current, []);

  const addAnchor = useCallback(
    (anchorOpts: import("../core/features/sheet-anchors").AnchorOptions) =>
      engineRef.current?.addAnchor(anchorOpts) ?? (() => {}),
    [],
  );
  const setScrimStages = useCallback(
    (
      stagesOpts:
        | import("../core/features/scrim-stages").ScrimStagesOptions
        | null,
    ) => engineRef.current?.setScrimStages(stagesOpts) ?? (() => {}),
    [],
  );
  const recompute = useCallback(() => engineRef.current?.recompute(), []);

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
        expand,
        collapse,
        isTop,
        depth,
        setAllowed,
        addAnchor,
        setScrimStages,
        recompute,
        engine: engineRef.current,
        getEngine,
      }) as unknown as UseBottomSheetReturn<TId>,
    [
      state,
      snapTo,
      open,
      close,
      expand,
      collapse,
      isTop,
      depth,
      setAllowed,
      addAnchor,
      setScrimStages,
      recompute,
      getEngine,
    ],
  );
}
