import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type {
  EngineOptions,
  EngineState,
  ScrimOverlayOptions,
  ScrimUpdate,
  SheetEventMap,
  SnapPointDef,
} from "../core/types";
import type { AnchorOptions } from "../core/features/sheet-anchors";
import type { ScrimStagesOptions } from "../core/features/scrim-stages";

export type SvelteBottomSheetOpts<TId extends string = string> = Omit<
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
  onSnap?: (id: TId) => void;
};

export type SvelteAttachRefs = {
  element: HTMLElement;
  handle?: HTMLElement;
  scrollContainer?: HTMLElement;
  backdrop?: HTMLElement;
  scrim?: HTMLElement;
};

export type SvelteBottomSheetController<TId extends string = string> = {
  attach: (refs: SvelteAttachRefs) => () => void;
  state: () => EngineState & { activeId: TId };
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
  snapTo: (id: TId) => Promise<void>;
  open: (id?: TId) => Promise<void>;
  close: () => Promise<void>;
  expand: () => Promise<void>;
  collapse: () => Promise<void>;
  isTop: () => boolean;
  depth: () => number;
  setAllowed: (ids: TId[], snap?: TId) => void;
  setSnapPoints: (
    points: EngineOptions["snapPoints"],
    allowed?: string[],
  ) => void;
  setScrim: (opts: ScrimUpdate) => void;
  setScrimOverlay: (opts: ScrimOverlayOptions) => () => void;
  addAnchor: (opts: AnchorOptions) => () => void;
  setScrimStages: (opts: ScrimStagesOptions | null) => () => void;
  recompute: () => void;
  destroy: () => void;
  getEngine: () => BottomSheetEngine | null;
};

const SSR_STATE: EngineState = Object.freeze({
  size: 0,
  activeId: "",
  isDragging: false,
  isAnimating: false,
  progress: 0,
});

export function createBottomSheet<TId extends string = string>(
  opts: SvelteBottomSheetOpts<TId>,
): SvelteBottomSheetController<TId> {
  let engine: BottomSheetEngine | null = null;
  type PendingEntry = {
    event: keyof SheetEventMap;
    fn: (p: any) => void;
    engineUnsub: (() => void) | null;
  };
  const pending: PendingEntry[] = [];

  const attach = (refs: SvelteAttachRefs) => {
    if (engine) engine.destroy();
    const { onSnap, ...engineOpts } = opts;
    const created = new BottomSheetEngine({
      ...(engineOpts as Omit<
        EngineOptions,
        "element" | "handle" | "scrollContainer" | "backdrop" | "scrim"
      >),
      ...refs,
    });
    engine = created;
    if (onSnap) {
      created.on("snap", payload => onSnap(payload.id as TId));
    }
    for (const entry of pending) {
      entry.engineUnsub = created.on(entry.event, entry.fn);
    }
    pending.length = 0;
    return () => {
      created.destroy();
      if (engine === created) engine = null;
    };
  };

  return {
    attach,
    state: () =>
      (engine?.state ?? SSR_STATE) as EngineState & { activeId: TId },
    on: <K extends keyof SheetEventMap>(
      event: K,
      fn: (payload: SheetEventMap[K]) => void,
    ): (() => void) => {
      if (engine) return engine.on(event, fn);
      const entry: PendingEntry = {
        event,
        fn: fn as (p: any) => void,
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
    snapTo: (id: TId) => engine?.snapTo(id) ?? Promise.resolve(),
    open: (id?: TId) => engine?.open(id) ?? Promise.resolve(),
    close: () => engine?.close() ?? Promise.resolve(),
    expand: () => engine?.expand() ?? Promise.resolve(),
    collapse: () => engine?.collapse() ?? Promise.resolve(),
    isTop: () => engine?.isTop() ?? false,
    depth: () => engine?.depth() ?? 0,
    setAllowed: (ids: TId[], snap?: TId) =>
      engine?.setAllowed(ids as unknown as string[], snap),
    setSnapPoints: (points: EngineOptions["snapPoints"], allowed?: string[]) =>
      engine?.setSnapPoints(points, allowed),
    setScrim: (scrimOpts: ScrimUpdate) => engine?.setScrim(scrimOpts),
    setScrimOverlay: (overlayOpts: ScrimOverlayOptions) =>
      engine?.setScrimOverlay(overlayOpts) ?? (() => {}),
    addAnchor: (anchorOpts: AnchorOptions) =>
      engine?.addAnchor(anchorOpts) ?? (() => {}),
    setScrimStages: (stagesOpts: ScrimStagesOptions | null) =>
      engine?.setScrimStages(stagesOpts) ?? (() => {}),
    recompute: () => engine?.recompute(),
    destroy: () => {
      engine?.destroy();
      engine = null;
    },
    getEngine: () => engine,
  };
}
