import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useBottomSheet } from "./useBottomSheet";
import type { BottomSheetEngine } from "../core/BottomSheetEngine";
import type { EngineOptions, EngineState } from "../core/types";
import type { AnchorOptions } from "../core/features/sheet-anchors";
import type {
  ScrimStageDef,
  ScrimStagesOptions,
} from "../core/features/scrim-stages";

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

export type BottomSheetAnchorProp = Omit<AnchorOptions, "element"> & {
  node: ReactNode;
};

export type BottomSheetScrimStageProp = Omit<ScrimStageDef, "element"> & {
  node: ReactNode;
};

export type BottomSheetScrimStagesProp = Omit<ScrimStagesOptions, "stages"> & {
  stages: BottomSheetScrimStageProp[];
};

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
  anchors?: BottomSheetAnchorProp[];
  scrimStages?: BottomSheetScrimStagesProp;
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
  addAnchor: (opts: AnchorOptions) => () => void;
  setScrimStages: (opts: ScrimStagesOptions | null) => () => void;
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
      anchors,
      scrimStages,
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

    const ariaModal = engineOpts.focusTrap === true;

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
        addAnchor: opts => getEngine()?.addAnchor(opts) ?? (() => {}),
        setScrimStages: opts => getEngine()?.setScrimStages(opts) ?? (() => {}),
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

    const [anchorHosts, setAnchorHosts] = useState<HTMLElement[]>([]);
    const anchorsKey = anchors
      ? JSON.stringify(
          anchors.map(a => [
            a.position,
            a.inset,
            Array.isArray(a.showOn) ? a.showOn : a.showOn ? "fn" : null,
            a.fadeRange,
            a.interactive,
            typeof a.animation === "string"
              ? a.animation
              : a.animation
                ? "custom"
                : null,
          ]),
        )
      : "";
    useEffect(() => {
      const engine = getEngine();
      if (!engine || !anchors || anchors.length === 0) return;
      const hosts: HTMLElement[] = [];
      const detachers = anchors.map(a => {
        const host = document.createElement("div");
        hosts.push(host);
        const { node: _node, ...rest } = a;
        return engine.addAnchor({ ...rest, element: host });
      });
      setAnchorHosts(hosts);
      return () => {
        detachers.forEach(d => d());
        setAnchorHosts([]);
      };
    }, [getEngine, anchorsKey]);

    const [stageHosts, setStageHosts] = useState<HTMLElement[]>([]);
    const stagesKey = scrimStages
      ? JSON.stringify(
          scrimStages.stages.map(s => [
            s.for,
            s.forRange,
            s.position,
            s.inset,
            s.interactive,
            typeof s.animation === "string"
              ? s.animation
              : s.animation
                ? "custom"
                : null,
          ]),
        )
      : "";
    useEffect(() => {
      const engine = getEngine();
      if (!engine || !scrimStages || scrimStages.stages.length === 0) return;
      const hosts: HTMLElement[] = [];
      const defs = scrimStages.stages.map(s => {
        const host = document.createElement("div");
        hosts.push(host);
        const { node: _node, ...rest } = s;
        return { ...rest, element: host };
      });
      const detach = engine.setScrimStages({ ...scrimStages, stages: defs });
      setStageHosts(hosts);
      return () => {
        detach();
        setStageHosts([]);
      };
    }, [getEngine, stagesKey]);

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
        {anchorHosts.map((host, i) =>
          anchors?.[i] ? createPortal(anchors[i]!.node, host) : null,
        )}
        {stageHosts.map((host, i) =>
          scrimStages?.stages[i]
            ? createPortal(scrimStages.stages[i]!.node, host)
            : null,
        )}
      </div>
    );
  },
);
