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

/**
 * JSON-serializable sheet configuration for CMS-driven / A-B / plugin /
 * server-driven UI. Functions can't be JSON, so handlers live in the
 * sibling `eventHandlers` prop keyed by `events.{onSnap,onOpen,onClose}`.
 *
 * Treat configs as immutable — derived props are memoized by config
 * identity, mutating in place leaves stale snap geometry behind.
 */
export type SheetConfig = {
  /** Schema version. Must be `1` for the current wrapper. */
  version: 1;
  /** Ordered list of snap points (smallest → largest). Required. */
  snapPoints: Array<{ id: string; size: number | string }>;
  /** Initial snap id. Falls back to first allowed (or first overall). */
  initial?: string;
  /** Subset of snap-point ids the sheet may settle on right now. */
  allowed?: string[];
  /** Direction the sheet expands from. Default: "bottom". */
  mode?: SheetMode;
  /** Animation strategy. Default: "spring". */
  animation?: "spring" | "tween";
  /** Spring config when `animation: "spring"`. */
  spring?: { stiffness?: number; damping?: number; mass?: number };
  /** Behavior toggles. All optional; missing keys fall back to engine defaults. */
  behavior?: {
    focusTrap?: boolean;
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
    lockBodyScroll?: boolean;
    rubberBand?: boolean;
  };
  /**
   * Map event name → handler key. The actual functions live in the
   * `eventHandlers` prop on the wrapper component, keyed by the same
   * string. Missing handler keys are tolerated (warn + no-op).
   */
  events?: { onSnap?: string; onOpen?: string; onClose?: string };
};

// Union (not optional arg) so TS accepts both `(id) => ...` and `() => ...`
// without surfacing `id?: string` to callers.
export type SheetEventHandler = ((id: string) => void) | (() => void);

export type BottomSheetFromConfigProps = {
  config: SheetConfig;
  eventHandlers?: Record<string, SheetEventHandler>;
  slotContent?: { header?: ReactNode; body?: ReactNode };
  /**
   * Memoize derived props by content (JSON.stringify) instead of identity.
   * Set when fetching via SWR / TanStack Query / RSC loaders that hand back
   * a fresh object on every cache hit — prevents engine rebuilds on byte-
   * identical revalidations. Default false keeps the cheap identity path.
   */
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

// Compile-time guard: when SheetConfig grows a new key, this fails to
// assign `true` until the allow-list is updated. No runtime cost.
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
// Reference the assertions so the compiler doesn't strip them as unused.
void _topLevelKeysCheck;
void _behaviorKeysCheck;
void _eventsKeysCheck;

const warnUnknownKeys = (
  obj: Record<string, unknown> | undefined,
  allowed: Set<string>,
  context: string,
): void => {
  if (!obj || typeof obj !== "object") return;
  // Batch into one warn per nesting level — a CMS payload with three typos
  // shouldn't emit three console.warns (six under Strict Mode).
  const unknown = Object.keys(obj).filter(k => !allowed.has(k));
  if (unknown.length === 0) return;
  console.warn(
    `[BottomSheetFromConfig] Unknown ${unknown.length === 1 ? "key" : "keys"} in ${context}: ${unknown.map(k => `"${k}"`).join(", ")}. Allowed: ${[...allowed].join(", ")}. Likely a typo — values ignored.`,
  );
};

// Dedupe warnings across React Strict Mode's double-invoke effects.
// WeakSet keys by identity so GC'd configs auto-evict.
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
    // Short-circuit so a future-schema config doesn't trigger unknown-key
    // warnings for every v2-only key against the v1 allow-list.
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

/** Default snap geometry the wrapper falls back to on invalid input. */
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

  // Memoize by config identity (or content hash if stableContent) — engine
  // rebuilds lose in-flight animations, focus trap, and scroll position.
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

  // Refs let the change handler read fresh handlers/events without tearing
  // down listeners on every parent render.
  const eventsRef = useRef(derived.events);
  eventsRef.current = derived.events;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const sheetRef = useRef<BottomSheetHandle | null>(null);

  // Forward the inner sheet's imperative handle through whatever ref the
  // consumer attached. `useImperativeHandle` runs after layout effects, so
  // by the time the parent calls .snapTo() the inner ref is populated;
  // it also nulls the ref on unmount automatically (no manual cleanup).
  useImperativeHandle(
    ref,
    () => sheetRef.current as BottomSheetHandle,
    [],
  );

  // BottomSheet surfaces only `onChange` (fires on snap settle). open/close
  // are inferred from activeId transitions to avoid engine-internal coupling.
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

    // Engine treats id "" / size 0 as closed. Detect open/close via the
    // activeId transition since BottomSheet doesn't surface engine events.
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
