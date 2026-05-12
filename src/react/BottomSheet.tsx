import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useBottomSheet } from "./useBottomSheet";
import type { BottomSheetEngine } from "../core/BottomSheetEngine";
import type { EngineOptions, EngineState } from "../core/types";

const useHasMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
};

type EngineOptionsForProps = Omit<
  EngineOptions,
  "element" | "handle" | "scrollContainer" | "backdrop" | "scrim"
>;

export type HeaderProp = ReactNode | ((state: EngineState) => ReactNode);

export type BottomSheetProps = EngineOptionsForProps & {
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  style?: CSSProperties;
  header?: HeaderProp;
  children?: ReactNode;
  leftButton?: ReactNode;
  rightButton?: ReactNode;
  screen?: ReactNode;
  onChange?: (state: EngineState) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  noSSR?: boolean;
};

export type BottomSheetHandle<TId extends string = string> = {
  snapTo: (id: TId) => Promise<void>;
  open: (id?: TId) => Promise<void>;
  close: () => Promise<void>;
  setAllowed: (ids: TId[], snap?: TId) => void;
  setSnapPoints: (
    points: import("../core/types").EngineOptions["snapPoints"],
    allowed?: string[],
  ) => void;
  setScrim: (opts: import("../core/types").ScrimUpdate) => void;
  setScrimOverlay: (
    opts: import("../core/types").ScrimOverlayOptions,
  ) => () => void;
  state: EngineState & { activeId: TId };
  getEngine: () => BottomSheetEngine | null;
};

export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function BottomSheet(props, ref) {
    const {
      backdrop = true,
      closeOnBackdrop = true,
      className = "",
      style,
      header,
      children,
      leftButton,
      rightButton,
      screen,
      onChange,
      ariaLabel = "Bottom sheet",
      ariaLabelledBy,
      noSSR = false,
      ...engineOpts
    } = props;
    const mounted = useHasMounted();

    const {
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
      getEngine,
    } = useBottomSheet(engineOpts);

    const isVerticalAxis =
      (engineOpts.mode ?? "bottom") === "bottom" ||
      (engineOpts.mode ?? "bottom") === "top";
    const ariaModal = engineOpts.focusTrap === true;
    const allowedIds =
      engineOpts.allowed ?? engineOpts.snapPoints.map(p => p.id);
    const activeIdx = allowedIds.indexOf(state.activeId);

    const lastAnnouncedRef = useRef<string>("");
    const [announce, setAnnounce] = useState("");
    useEffect(() => {
      if (state.activeId !== lastAnnouncedRef.current) {
        lastAnnouncedRef.current = state.activeId;
        setAnnounce(state.activeId);
      }
    }, [state.activeId]);

    useImperativeHandle(
      ref,
      () => ({
        snapTo,
        open,
        close,
        setAllowed,
        setSnapPoints: (points, allowed) =>
          getEngine()?.setSnapPoints(points, allowed),
        setScrim: opts => getEngine()?.setScrim(opts),
        setScrimOverlay: opts => getEngine()?.setScrimOverlay(opts) ?? (() => {}),
        getEngine,
        get state() {
          return getEngine()?.state ?? state;
        },
      }),
      [snapTo, open, close, setAllowed, getEngine, state],
    );

    useEffect(() => {
      onChange?.(state);
    }, [state, onChange]);

    if (noSSR && !mounted) return null;

    return (
      <div className="bs-root">
        {backdrop && (
          <div
            ref={backdropRef as React.RefObject<HTMLDivElement>}
            className="bs-backdrop"
            onClick={closeOnBackdrop ? () => void close() : undefined}
          />
        )}
        <div
          ref={screenRef as React.RefObject<HTMLDivElement>}
          className="bs-screen"
        >
          {screen}
        </div>
        <section
          ref={sheetRef as React.RefObject<HTMLElement>}
          className={`bs-sheet ${className}`.trim()}
          style={style}
          data-mode={engineOpts.mode ?? "bottom"}
          data-active={state.activeId}
          role={ariaModal ? "dialog" : "region"}
          aria-modal={ariaModal ? "true" : undefined}
          aria-label={ariaLabelledBy ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledBy}
        >
          {leftButton && (
            <div className="bs-button-slot" data-side="left">
              {leftButton}
            </div>
          )}
          {rightButton && (
            <div className="bs-button-slot" data-side="right">
              {rightButton}
            </div>
          )}
          <div
            ref={handleRef as React.RefObject<HTMLDivElement>}
            className="bs-handle"
            role="slider"
            tabIndex={0}
            aria-orientation={isVerticalAxis ? "vertical" : "horizontal"}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, allowedIds.length - 1)}
            aria-valuenow={Math.max(0, activeIdx)}
            aria-valuetext={state.activeId}
            aria-label="Resize sheet"
          >
            {typeof header === "function" ? header(state) : header}
          </div>
          <div
            ref={contentRef as React.RefObject<HTMLDivElement>}
            className="bs-content"
            tabIndex={0}
            role="region"
            aria-label="Sheet content"
          >
            {children}
          </div>
          <span className="bs-sr-only" role="status" aria-live="polite">
            {announce}
          </span>
        </section>
      </div>
    );
  },
);
