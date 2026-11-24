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
import { guessPhysicalMode } from "../core/primitives/logical-mode";
import { startsClosed } from "../core/primitives/snap-points";
import { closedSnapId, syncOpen } from "../core/primitives/open-state";
import type {
  CloseReason,
  EngineOptions,
  EngineState,
  MoveOutcome,
  PhysicalSheetMode,
  SheetEventMap,
} from "../core/types";
import type { TeleportTarget } from "../core/features/teleport";
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
  footer?: HeaderProp;
  children?: ReactNode;
  leftButton?: ReactNode;
  rightButton?: ReactNode;
  screen?: ReactNode;
  anchors?: BottomSheetAnchorProp[];
  scrimStages?: BottomSheetScrimStagesProp;
  teleportTo?: TeleportTarget;
  backdropColor?: string;
  backdropOpacity?: number;
  onChange?: (state: EngineState) => void;
  onSnap?: (id: string) => void;
  onBeforeSnap?: (payload: SheetEventMap["before-snap"]) => void;
  onBeforeClose?: (payload: SheetEventMap["before-close"]) => void;
  onOpen?: (id: string) => void;
  onClose?: () => void;
  onOpened?: (id: string) => void;
  onClosed?: () => void;
  onDragStart?: (payload: SheetEventMap["dragstart"]) => void;
  onDragEnd?: (payload: SheetEventMap["dragend"]) => void;
  onDrag?: (payload: SheetEventMap["drag"]) => void;
  onProgress?: (payload: SheetEventMap["progress"]) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  handleLabel?: string;
  contentLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  noSSR?: boolean;
};

export type BottomSheetHandle<TId extends string = string> = {
  snapTo: (id: TId) => Promise<MoveOutcome>;
  open: (id?: TId) => Promise<MoveOutcome>;
  close: (reason?: CloseReason) => Promise<MoveOutcome>;
  expand: () => Promise<MoveOutcome>;
  collapse: () => Promise<MoveOutcome>;
  isTop: () => boolean;
  depth: () => number;
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
  recompute: () => void;
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
  state: EngineState & { activeId: TId };
  getEngine: () => BottomSheetEngine | null;
};

export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function BottomSheet(props, ref) {
    const mounted = useHasMounted();
    if (props.noSSR && !mounted) return null;
    return <MountedBottomSheet {...props} ref={ref} />;
  },
);

const MountedBottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function MountedBottomSheet(props, ref) {
    const {
      backdrop = true,
      closeOnBackdrop = true,
      className = "",
      style,
      header,
      footer,
      children,
      leftButton,
      rightButton,
      screen,
      anchors,
      scrimStages,
      onChange,
      onBeforeClose,
      onOpen,
      onClose,
      onOpened,
      onClosed,
      onDragStart,
      onDragEnd,
      onDrag,
      onProgress,
      ariaLabel = "Bottom sheet",
      ariaLabelledBy,
      handleLabel = "Resize sheet",
      contentLabel = "Sheet content",
      open: openProp,
      onOpenChange,
      noSSR: _noSSR,
      ...engineOpts
    } = props;

    const initial =
      engineOpts.initial ??
      (openProp === false ? closedSnapId(engineOpts.snapPoints) : undefined);

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
      expand,
      collapse,
      isTop,
      depth,
      setAllowed,
      on,
      getEngine,
    } = useBottomSheet({
      ...engineOpts,
      initial,
      onBeforeClose,
      onOpen: id => {
        onOpen?.(id);
        onOpenChange?.(true);
      },
      onClose: () => {
        onClose?.();
        onOpenChange?.(false);
      },
      onOpened,
      onClosed,
      onDragStart,
      onDragEnd,
      onDrag,
      onProgress,
    });

    const ariaModal = engineOpts.focusTrap === true;

    useEffect(() => {
      const engine = getEngine();
      if (openProp !== undefined && engine) syncOpen(engine, openProp);
    }, [openProp, getEngine]);

    const lastAnnouncedRef = useRef<string>("");
    const [announce, setAnnounce] = useState("");
    useEffect(() => {
      if (state.activeLabel !== lastAnnouncedRef.current) {
        lastAnnouncedRef.current = state.activeLabel;
        setAnnounce(state.activeLabel);
      }
    }, [state.activeLabel]);

    useImperativeHandle(
      ref,
      () => ({
        snapTo,
        open,
        close,
        expand,
        collapse,
        isTop,
        depth,
        setAllowed,
        setSnapPoints: (points, allowed) =>
          getEngine()?.setSnapPoints(points, allowed),
        setScrim: opts => getEngine()?.setScrim(opts),
        setScrimOverlay: opts => getEngine()?.setScrimOverlay(opts) ?? (() => {}),
        addAnchor: opts => getEngine()?.addAnchor(opts) ?? (() => {}),
        setScrimStages: opts => getEngine()?.setScrimStages(opts) ?? (() => {}),
        recompute: () => getEngine()?.recompute(),
        on,
        getEngine,
        get state() {
          return getEngine()?.state ?? state;
        },
      }),
      [
        snapTo,
        open,
        close,
        expand,
        collapse,
        isTop,
        depth,
        setAllowed,
        getEngine,
        state,
      ],
    );

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    useEffect(() => {
      onChangeRef.current?.(state);
    }, [state]);

    const mode = engineOpts.mode;
    const [physicalMode, setPhysicalMode] = useState<PhysicalSheetMode>(() =>
      guessPhysicalMode(mode),
    );
    useEffect(() => {
      const engine = getEngine();
      if (!engine) {
        setPhysicalMode(guessPhysicalMode(mode));
        return;
      }
      if (mode !== undefined) engine.setMode(mode);
      setPhysicalMode(engine.getMode());
    }, [getEngine, mode]);

    const [restAtStart] = useState(() =>
      startsClosed(engineOpts.snapPoints, initial, engineOpts.allowed)
        ? "closed"
        : undefined,
    );

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

    return (
      <div className="bs-root">
        {backdrop && (
          <div
            ref={backdropRef}
            className="bs-backdrop"
            onClick={
              closeOnBackdrop
                ? () => {
                    if (getEngine()?.canDismiss()) void close("backdrop");
                  }
                : undefined
            }
          />
        )}
        <div
          ref={screenRef}
          className="bs-screen"
        >
          {screen}
        </div>
        <section
          ref={sheetRef}
          className={`bs-sheet ${className}`.trim()}
          style={style}
          data-mode={physicalMode}
          data-bs-rest={restAtStart}
          data-active={state.activeId}
          role={ariaModal ? "dialog" : "region"}
          aria-modal={ariaModal ? "true" : undefined}
          aria-label={ariaLabelledBy ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledBy}
        >
          <div
            ref={handleRef}
            className="bs-handle"
            role="slider"
            tabIndex={0}
            aria-label={handleLabel}
          />
          {header != null && header !== false && (
            <div className="bs-header">
              {typeof header === "function" ? header(state) : header}
            </div>
          )}
          <div
            ref={contentRef}
            className="bs-content"
            tabIndex={0}
            role="region"
            aria-label={contentLabel}
          >
            {children}
          </div>
          {footer != null && footer !== false && (
            <div className="bs-footer">
              {typeof footer === "function" ? footer(state) : footer}
            </div>
          )}
          <span className="bs-sr-only" role="status" aria-live="polite">
            {announce}
          </span>
        </section>
        {leftButton && (
          <div
            className="bs-button-slot"
            data-side="left"
            data-mode={physicalMode}
          >
            {leftButton}
          </div>
        )}
        {rightButton && (
          <div
            className="bs-button-slot"
            data-side="right"
            data-mode={physicalMode}
          >
            {rightButton}
          </div>
        )}
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
