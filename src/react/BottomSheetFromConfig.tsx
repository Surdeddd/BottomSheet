import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { BottomSheet, type BottomSheetHandle } from "./BottomSheet";
import type { SnapPoint } from "../core/types";
import {
  FALLBACK_SNAP_POINTS,
  SUPPORTED_VERSION,
  validateConfig,
  type SheetConfig,
  type SheetEventHandler,
} from "./config-validation";

export type { SheetConfig, SheetEventHandler } from "./config-validation";

export type BottomSheetFromConfigProps = {
  config: SheetConfig;
  eventHandlers?: Record<string, SheetEventHandler>;
  slotContent?: { header?: ReactNode; body?: ReactNode };
  stableContent?: boolean;
};

export const BottomSheetFromConfig = forwardRef<
  BottomSheetHandle,
  BottomSheetFromConfigProps
>(function BottomSheetFromConfig(props, ref) {
  const { config, eventHandlers, slotContent, stableContent = false } = props;

  useEffect(() => {
    validateConfig(config);
  }, [config]);

  const memoKey = stableContent ? JSON.stringify(config) : config;
  const derived = useMemo(() => {
    const valid = config.version === SUPPORTED_VERSION;
    const hasSnapPoints =
      Array.isArray(config.snapPoints) && config.snapPoints.length > 0;
    return {
      snapPoints:
        valid && hasSnapPoints
          ? (config.snapPoints as Array<{ id: string; size: SnapPoint }>)
          : FALLBACK_SNAP_POINTS,
      initial: config.initial,
      allowed: config.allowed,
      mode: config.mode,
      animation: config.animation,
      spring: config.spring,
      behavior: config.behavior ?? {},
      events: config.events ?? {},
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoKey]);

  const handlers = eventHandlers ?? {};

  const eventsRef = useRef(derived.events);
  eventsRef.current = derived.events;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const sheetRef = useRef<BottomSheetHandle | null>(null);

  useImperativeHandle(
    ref,
    () => sheetRef.current as BottomSheetHandle,
    [],
  );

  const invoke = (
    key: "onSnap" | "onOpen" | "onClose",
    arg?: string,
  ): void => {
    const evName = eventsRef.current[key];
    if (!evName) return;
    const fn = handlersRef.current[evName];
    if (typeof fn === "function") {
      if (arg === undefined) {
        (fn as () => void)();
      } else {
        fn(arg);
      }
    } else {
      console.warn(
        `[BottomSheetFromConfig] eventHandlers["${evName}"] is not a function; ${key} is a no-op.`,
      );
    }
  };
  const invokeRef = useRef(invoke);
  invokeRef.current = invoke;

  useEffect(() => {
    const engine = sheetRef.current?.getEngine();
    if (!engine) return;
    const offs = [
      engine.on("snap", p => invokeRef.current("onSnap", p.id)),
      engine.on("open", p => invokeRef.current("onOpen", p.id)),
      engine.on("close", () => invokeRef.current("onClose")),
    ];
    return () => offs.forEach(off => off());
  }, []);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={derived.snapPoints}
      initial={derived.initial}
      allowed={derived.allowed}
      mode={derived.mode}
      animation={derived.animation}
      spring={derived.spring}
      focusTrap={derived.behavior.focusTrap}
      closeOnEscape={derived.behavior.closeOnEscape}
      closeOnBackdrop={derived.behavior.closeOnBackdrop}
      lockBodyScroll={derived.behavior.lockBodyScroll}
      rubberBand={derived.behavior.rubberBand}
      header={slotContent?.header}
    >
      {slotContent?.body}
    </BottomSheet>
  );
});
