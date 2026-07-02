import { devWarn } from "../core/primitives/devWarn";
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

export const SUPPORTED_VERSION = 1;

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
  devWarn(
    `[BottomSheetFromConfig] Unknown ${unknown.length === 1 ? "key" : "keys"} in ${context}: ${unknown.map(k => `"${k}"`).join(", ")}. Allowed: ${[...allowed].join(", ")}. Likely a typo — values ignored.`,
  );
};

const validatedConfigs = new WeakSet<object>();

export function validateConfig(config: SheetConfig): boolean {
  if (validatedConfigs.has(config)) return true;
  validatedConfigs.add(config);

  let ok = true;

  if (config.version !== SUPPORTED_VERSION) {
    devWarn(
      `[BottomSheetFromConfig] Unsupported config version ${String(
        config.version,
      )}; expected ${SUPPORTED_VERSION}. Falling back to defaults.`,
    );
    return false;
  }

  if (!Array.isArray(config.snapPoints) || config.snapPoints.length === 0) {
    devWarn(
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

export const FALLBACK_SNAP_POINTS = [
  { id: "default", size: "full" as SnapPoint },
];
