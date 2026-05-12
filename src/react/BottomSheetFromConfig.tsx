import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { BottomSheet, type BottomSheetHandle } from "./BottomSheet";
import type { SheetMode, SnapPoint } from "../core/types";

export type SheetConfig = {
  version: 1;
  snapPoints: Array<{ id: string; size: number | string }>;
  initial?: string;
  allowed?: string[];
  mode?: SheetMode;
  animation?: "spring" | "tween";
  spring?: { stiffness?: number; damping?: number; mass?: number };
  behavior?: {
    focusTrap?: boolean;
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
    lockBodyScroll?: boolean;
    rubberBand?: boolean;
  };
  events?: { onSnap?: string; onOpen?: string; onClose?: string };
};

export type SheetEventHandler = ((id: string) => void) | (() => void);

export type BottomSheetFromConfigProps = {
  config: SheetConfig;
  eventHandlers?: Record<string, SheetEventHandler>;
  slotContent?: { header?: ReactNode; body?: ReactNode };
  stableContent?: boolean;
};

const SUPPORTED_VERSION = 1;

const TOP_LEVEL_KEYS = new Set([
  "version",
  "snapPoints",
  "initial",
  "allowed",
  "mode",
  "animation",
  "spring",
  "behavior",
  "events",
]);
const BEHAVIOR_KEYS = new Set([
  "focusTrap",
  "closeOnEscape",
  "closeOnBackdrop",
  "lockBodyScroll",
  "rubberBand",
]);
const EVENTS_KEYS = new Set(["onSnap", "onOpen", "onClose"]);

type _EnsureAllKeys<TKeys extends string, TType> =
  Exclude<keyof TType, TKeys> extends never
    ? Exclude<TKeys, keyof TType> extends never
      ? true
      : ["[BottomSheetFromConfig] extra keys in allow-list:", Exclude<TKeys, keyof TType>]
    : [
        "[BottomSheetFromConfig] missing keys in allow-list:",
        Exclude<keyof TType, TKeys>,
      ];

const _topLevelKeysCheck: _EnsureAllKeys<
  | "version"
  | "snapPoints"
  | "initial"
  | "allowed"
  | "mode"
  | "animation"
  | "spring"
  | "behavior"
  | "events",
  SheetConfig
> = true;
const _behaviorKeysCheck: _EnsureAllKeys<
  | "focusTrap"
  | "closeOnEscape"
  | "closeOnBackdrop"
  | "lockBodyScroll"
  | "rubberBand",
  NonNullable<SheetConfig["behavior"]>
> = true;
const _eventsKeysCheck: _EnsureAllKeys<
  "onSnap" | "onOpen" | "onClose",
  NonNullable<SheetConfig["events"]>
> = true;
void _topLevelKeysCheck;
void _behaviorKeysCheck;
void _eventsKeysCheck;

const warnUnknownKeys = (
  obj: Record<string, unknown> | undefined,
  allowed: Set<string>,
  context: string,
): void => {
  if (!obj || typeof obj !== "object") return;
  const unknown = Object.keys(obj).filter(k => !allowed.has(k));
  if (unknown.length === 0) return;
  console.warn(
    `[BottomSheetFromConfig] Unknown ${unknown.length === 1 ? "key" : "keys"} in ${context}: ${unknown.map(k => `"${k}"`).join(", ")}. Allowed: ${[...allowed].join(", ")}. Likely a typo — values ignored.`,
  );
};

const validatedConfigs = new WeakSet<object>();

function validateConfig(config: SheetConfig): boolean {
  if (validatedConfigs.has(config)) return true;
  validatedConfigs.add(config);

  let ok = true;

  if (config.version !== SUPPORTED_VERSION) {
    console.warn(
      `[BottomSheetFromConfig] Unsupported config version ${String(
        config.version,
      )}; expected ${SUPPORTED_VERSION}. Falling back to defaults.`,
    );
    return false;
  }

  if (!Array.isArray(config.snapPoints) || config.snapPoints.length === 0) {
    console.warn(
      "[BottomSheetFromConfig] config.snapPoints is missing or empty; using a single full-height fallback snap.",
    );
    ok = false;
  }

  warnUnknownKeys(
    config as unknown as Record<string, unknown>,
    TOP_LEVEL_KEYS,
    "config",
  );
  warnUnknownKeys(
    config.behavior as unknown as Record<string, unknown> | undefined,
    BEHAVIOR_KEYS,
    "config.behavior",
  );
  warnUnknownKeys(
    config.events as unknown as Record<string, unknown> | undefined,
    EVENTS_KEYS,
    "config.events",
  );

  return ok;
}

const FALLBACK_SNAP_POINTS = [
  { id: "default", size: "full" as SnapPoint },
];

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

  const lastActiveIdRef = useRef<string | null>(null);

  const handleChange = (state: { activeId: string }) => {
    const prev = lastActiveIdRef.current;
    const next = state.activeId;
    lastActiveIdRef.current = next;

    const evs = eventsRef.current;
    const hs = handlersRef.current;

    if (evs.onSnap) {
      const fn = hs[evs.onSnap];
      if (typeof fn === "function") {
        fn(next);
      } else {
        console.warn(
          `[BottomSheetFromConfig] eventHandlers["${evs.onSnap}"] is not a function; onSnap is a no-op.`,
        );
      }
    }

    const isClosedNext = next === "" || next === "closed";
    const isClosedPrev = prev === null || prev === "" || prev === "closed";

    if (isClosedPrev && !isClosedNext && evs.onOpen) {
      const fn = hs[evs.onOpen];
      if (typeof fn === "function") {
        fn(next);
      } else {
        console.warn(
          `[BottomSheetFromConfig] eventHandlers["${evs.onOpen}"] is not a function; onOpen is a no-op.`,
        );
      }
    }

    if (!isClosedPrev && isClosedNext && evs.onClose) {
      const fn = hs[evs.onClose];
      if (typeof fn === "function") {
        (fn as () => void)();
      } else {
        console.warn(
          `[BottomSheetFromConfig] eventHandlers["${evs.onClose}"] is not a function; onClose is a no-op.`,
        );
      }
    }
  };

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
      onChange={handleChange}
      header={slotContent?.header}
    >
      {slotContent?.body}
    </BottomSheet>
  );
});
