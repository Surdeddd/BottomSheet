import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { OverlayEngine, type OverlayOptions, type OverlayState } from "../core/overlay";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type UseOverlayReturn = {
  panelRef: React.RefObject<HTMLElement>;
  backdropRef: React.RefObject<HTMLElement>;
  state: OverlayState;
  open: () => Promise<void>;
  close: () => Promise<void>;
  toggle: () => Promise<void>;
  /**
   * Lazy accessor for the underlying engine. Returns null on SSR or before
   * the layout effect mounts the engine. Use this — not a snapshot — so you
   * always read the current instance.
   */
  getEngine: () => OverlayEngine | null;
};

export const useOverlay = (
  opts: Omit<OverlayOptions, "element" | "backdrop">,
): UseOverlayReturn => {
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLElement>(null);
  const engineRef = useRef<OverlayEngine | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [state, setState] = useState<OverlayState>({
    isOpen: opts.initialOpen ?? false,
    isAnimating: false,
  });

  useIsomorphicLayoutEffect(() => {
    if (!panelRef.current) return;
    const engine = new OverlayEngine({
      ...optsRef.current,
      element: panelRef.current,
      backdrop: backdropRef.current ?? undefined,
    });
    engineRef.current = engine;
    setState(engine.state);

    const sync = () => setState(engine.state);
    const offs = [
      engine.on("open", sync),
      engine.on("close", sync),
      engine.on("before-open", sync),
      engine.on("before-close", sync),
    ];
    return () => {
      offs.forEach(off => off());
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback(
    () => engineRef.current?.open() ?? Promise.resolve(),
    [],
  );
  const close = useCallback(
    () => engineRef.current?.close() ?? Promise.resolve(),
    [],
  );
  const toggle = useCallback(
    () => engineRef.current?.toggle() ?? Promise.resolve(),
    [],
  );

  const getEngine = useCallback(() => engineRef.current, []);

  return useMemo(
    () => ({
      panelRef,
      backdropRef,
      state,
      open,
      close,
      toggle,
      getEngine,
    }),
    [state, open, close, toggle, getEngine],
  );
};
