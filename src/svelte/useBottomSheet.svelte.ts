import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type {
  EngineOptions,
  EngineState,
  SheetEventMap,
  SnapPointDef,
} from "../core/types";

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
  setAllowed: (ids: TId[], snap?: TId) => void;
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
    engine = new BottomSheetEngine({
      ...(engineOpts as Omit<
        EngineOptions,
        "element" | "handle" | "scrollContainer" | "backdrop" | "scrim"
      >),
      ...refs,
    });
    if (onSnap) {
      engine.on("snap", payload => onSnap(payload.id as TId));
    }
    for (const entry of pending) {
      entry.engineUnsub = engine.on(entry.event, entry.fn);
    }
    pending.length = 0;
    return () => {
      engine?.destroy();
      engine = null;
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
    setAllowed: (ids: TId[], snap?: TId) =>
      engine?.setAllowed(ids as unknown as string[], snap),
    destroy: () => {
      engine?.destroy();
      engine = null;
    },
    getEngine: () => engine,
  };
}
