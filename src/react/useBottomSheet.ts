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
import { useEnginePropSync } from "./useEnginePropSync";
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
  onBeforeSnap?: (payload: SheetEventMap["before-snap"]) => void;
  onBeforeClose?: (payload: SheetEventMap["before-close"]) => void;
  onOpen?: (id: TId) => void;
  onClose?: () => void;
  onOpened?: (id: TId) => void;
  onClosed?: () => void;
  onDragStart?: (payload: SheetEventMap["dragstart"]) => void;
  onDragEnd?: (payload: SheetEventMap["dragend"]) => void;
  onDrag?: (payload: SheetEventMap["drag"]) => void;
  onProgress?: (payload: SheetEventMap["progress"]) => void;
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
      engine.on("before-snap", payload => {
        optsRef.current.onBeforeSnap?.(payload);
      }),
      engine.on("before-close", payload => {
        optsRef.current.onBeforeClose?.(payload);
      }),
      engine.on("open", payload => {
        optsRef.current.onOpen?.(payload.id as TId);
      }),
      engine.on("close", () => {
        optsRef.current.onClose?.();
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
    if (optsRef.current.onDrag) {
      offs.push(
        engine.on("drag", payload => {
          optsRef.current.onDrag?.(payload);
        }),
      );
    }
    if (optsRef.current.onProgress) {
      offs.push(
        engine.on("progress", payload => {
          optsRef.current.onProgress?.(payload);
        }),
      );
    }
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

  useEnginePropSync(engineRef, {
    snapPoints: opts.snapPoints,
    allowed: opts.allowed,
    backdropColor: opts.backdropColor,
    backdropOpacity: opts.backdropOpacity,
    radius: opts.radius,
    maxHeight: opts.maxHeight,
    persistent: opts.persistent,
    disableClose: opts.disableClose,
    disableDrag: opts.disableDrag,
  });

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
