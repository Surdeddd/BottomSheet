import { onBeforeUnmount, onMounted, reactive, ref, type Ref } from "vue";
import { BottomSheetEngine } from "../core/BottomSheetEngine";
import {
  resolveTeleportTarget,
  teleportElements,
  type TeleportTarget,
} from "../core/features/teleport";
import type {
  EngineOptions,
  EngineState,
  SheetEventMap,
  SnapPointDef,
} from "../core/types";

export type UseBottomSheetVueOptions<TId extends string = string> = Omit<
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
  close: (reason?: import("../core/types").CloseReason) => Promise<void>;
  setAllowed: (ids: TId[], snap?: TId) => void;
  setSnapPoints: (
    points: EngineOptions["snapPoints"],
    allowed?: string[],
  ) => void;
  setScrim: (opts: import("../core/types").ScrimUpdate) => void;
  setScrimOverlay: (
    opts: import("../core/types").ScrimOverlayOptions,
  ) => () => void;
  addAnchor: (
    opts: import("../core/features/sheet-anchors").AnchorOptions,
  ) => () => void;
  setScrimStages: (
    opts: import("../core/features/scrim-stages").ScrimStagesOptions | null,
  ) => () => void;
  recompute: () => void;
  setScrimColor: (color: string | undefined | null) => void;
  setBackdropRange: (range: [number, number]) => void;
  setRadius: (r: string | number) => void;
  setMaxHeight: (h: string | number) => void;
  expand: () => Promise<void>;
  collapse: () => Promise<void>;
  isTop: () => boolean;
  depth: () => number;
  canDismiss: () => boolean;
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
  getEngine: () => BottomSheetEngine | null;
};

export function useBottomSheet<TId extends string = string>(
  opts: UseBottomSheetVueOptions<TId>,
): UseBottomSheetVueReturn<TId> {
  const sheetRef = ref<HTMLElement | null>(null);
  const handleRef = ref<HTMLElement | null>(null);
  const contentRef = ref<HTMLElement | null>(null);
  const backdropRef = ref<HTMLElement | null>(null);
  const screenRef = ref<HTMLElement | null>(null);
  let engine: BottomSheetEngine | null = null;
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

  let restoreTeleport: (() => void) | null = null;

  const sync = (): void => {
    if (!engine) return;
    Object.assign(state, engine.state);
  };

  onMounted(() => {
    if (!sheetRef.value) return;
    const {
      onSnap,
      teleportTo,
      backdropColor,
      backdropOpacity,
      ...engineOpts
    } = opts;
    engine = new BottomSheetEngine({
      ...(engineOpts as Omit<
        EngineOptions,
        "element" | "handle" | "scrollContainer" | "backdrop" | "scrim"
      >),
      element: sheetRef.value,
      handle: handleRef.value ?? undefined,
      scrollContainer: contentRef.value ?? undefined,
      backdrop: backdropRef.value ?? undefined,
      scrim: screenRef.value ?? undefined,
    });
    sync();

    const target = resolveTeleportTarget(teleportTo);
    if (target) {
      restoreTeleport = teleportElements(
        [backdropRef.value, screenRef.value, sheetRef.value],
        target,
      );
    }
    if (backdropColor !== undefined) engine.setScrimColor(backdropColor);
    if (backdropOpacity !== undefined) {
      engine.setBackdropRange([0, backdropOpacity]);
    }

    engine.on("snap", payload => {
      sync();
      onSnap?.(payload.id as TId);
    });
    engine.on("dragstart", sync);
    engine.on("dragend", sync);

    for (const entry of pending) {
      entry.engineUnsub = engine.on(
        entry.event,
        entry.fn as (payload: SheetEventMap[typeof entry.event]) => void,
      );
    }
    pending.length = 0;
  });

  onBeforeUnmount(() => {
    restoreTeleport?.();
    restoreTeleport = null;
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
    close: (reason?: import("../core/types").CloseReason) =>
      engine?.close(reason) ?? Promise.resolve(),
    setAllowed: (ids: TId[], snap?: TId) =>
      engine?.setAllowed(ids as unknown as string[], snap),
    setSnapPoints: (
      points: EngineOptions["snapPoints"],
      allowed?: string[],
    ) => engine?.setSnapPoints(points, allowed),
    setScrim: (opts: import("../core/types").ScrimUpdate) =>
      engine?.setScrim(opts),
    setScrimOverlay: (opts: import("../core/types").ScrimOverlayOptions) =>
      engine?.setScrimOverlay(opts) ?? (() => {}),
    addAnchor: (
      opts: import("../core/features/sheet-anchors").AnchorOptions,
    ) => engine?.addAnchor(opts) ?? (() => {}),
    setScrimStages: (
      opts: import("../core/features/scrim-stages").ScrimStagesOptions | null,
    ) => engine?.setScrimStages(opts) ?? (() => {}),
    recompute: () => engine?.recompute(),
    setScrimColor: (color: string | undefined | null) =>
      engine?.setScrimColor(color),
    setBackdropRange: (range: [number, number]) =>
      engine?.setBackdropRange(range),
    setRadius: (r: string | number) => engine?.setRadius(r),
    setMaxHeight: (h: string | number) => engine?.setMaxHeight(h),
    expand: () => engine?.expand() ?? Promise.resolve(),
    collapse: () => engine?.collapse() ?? Promise.resolve(),
    isTop: () => engine?.isTop() ?? false,
    depth: () => engine?.depth() ?? 0,
    canDismiss: () => engine?.canDismiss() ?? false,
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
    getEngine: () => engine,
  } as unknown as UseBottomSheetVueReturn<TId>;
}
