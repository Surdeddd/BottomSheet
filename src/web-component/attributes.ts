import type { EngineOptions, SnapPointDef } from "../core/types";
import type {
  AnchorOptions,
  AnchorPosition,
} from "../core/features/sheet-anchors";
import type { AnchorAnimationPreset } from "../core/primitives/anchor-animations";

export const ATTR_SNAP_POINTS = "snap-points";
export const ATTR_ALLOWED = "allowed";
export const ATTR_INITIAL = "initial";
export const ATTR_MODE = "mode";
export const ATTR_BACKDROP = "backdrop";
export const ATTR_STYLESHEET = "stylesheet";
export const ATTR_ANIMATION = "animation";
export const ATTR_FOCUS_TRAP = "focus-trap";
export const ATTR_CLOSE_ON_ESCAPE = "close-on-escape";
export const ATTR_LOCK_BODY_SCROLL = "lock-body-scroll";
export const ATTR_SHEET_LABEL = "sheet-label";
export const ATTR_STACK_EFFECT = "stack-effect";
export const ATTR_PERSISTENT = "persistent";
export const ATTR_DISABLE_CLOSE = "disable-close";
export const ATTR_DISABLE_DRAG = "disable-drag";
export const ATTR_DRAG_FROM = "drag-from";
export const ATTR_DRAG_FROM_CONTENT = "drag-from-content";
export const ATTR_CLOSE_ON_ROUTE_CHANGE = "close-on-route-change";
export const ATTR_RADIUS = "radius";
export const ATTR_MAX_HEIGHT = "max-height";
export const ATTR_RETURN_FOCUS_TO = "return-focus-to";
export const ATTR_BACKDROP_COLOR = "backdrop-color";
export const ATTR_SCRIM_COLOR = "scrim-color";
export const ATTR_SNAP = "snap";

export const LIVE_ATTRS: ReadonlySet<string> = new Set([
  ATTR_RADIUS,
  ATTR_MAX_HEIGHT,
  ATTR_BACKDROP_COLOR,
  ATTR_SCRIM_COLOR,
  ATTR_SNAP,
  ATTR_PERSISTENT,
  ATTR_DISABLE_CLOSE,
  ATTR_DISABLE_DRAG,
  ATTR_DRAG_FROM,
  ATTR_DRAG_FROM_CONTENT,
]);

export const OBSERVED_ATTRS: ReadonlyArray<string> = [
  ATTR_SNAP_POINTS,
  ATTR_ALLOWED,
  ATTR_INITIAL,
  ATTR_MODE,
  ATTR_BACKDROP,
  ATTR_ANIMATION,
  ATTR_FOCUS_TRAP,
  ATTR_CLOSE_ON_ESCAPE,
  ATTR_LOCK_BODY_SCROLL,
  ATTR_SHEET_LABEL,
  ATTR_STACK_EFFECT,
  ATTR_PERSISTENT,
  ATTR_DISABLE_CLOSE,
  ATTR_DISABLE_DRAG,
  ATTR_DRAG_FROM,
  ATTR_DRAG_FROM_CONTENT,
  ATTR_CLOSE_ON_ROUTE_CHANGE,
  ATTR_RADIUS,
  ATTR_MAX_HEIGHT,
  ATTR_RETURN_FOCUS_TO,
  ATTR_BACKDROP_COLOR,
  ATTR_SCRIM_COLOR,
  ATTR_SNAP,
];

const isValidSnapPoint = (p: unknown): p is SnapPointDef =>
  !!p &&
  typeof p === "object" &&
  typeof (p as SnapPointDef).id === "string" &&
  (typeof (p as SnapPointDef).size === "number" ||
    typeof (p as SnapPointDef).size === "string");

const DEFAULT_SNAP_POINTS: SnapPointDef[] = [{ id: "full", size: "full" }];

export const parseSnapPoints = (raw: string | null): SnapPointDef[] => {
  if (!raw) return DEFAULT_SNAP_POINTS;

  try {
    const parsed = JSON.parse(raw);

    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(isValidSnapPoint)
    ) {
      return parsed;
    }

    if (Array.isArray(parsed)) return DEFAULT_SNAP_POINTS;
  } catch {

  }
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(part => {
      const [id, size] = part.split(":").map(s => s.trim());
      const numeric = Number(size);
      const resolvedSize = Number.isFinite(numeric)
        ? numeric
        : (size as SnapPointDef["size"]);
      return { id: id ?? "default", size: resolvedSize };
    });
};

const VALID_MODES: ReadonlyArray<NonNullable<EngineOptions["mode"]>> = [
  "bottom",
  "top",
  "left",
  "right",
];

const VALID_ANIMATIONS: ReadonlyArray<NonNullable<EngineOptions["animation"]>> =
  ["spring", "tween", "ios-spring", "material-bounce", "linear", "snappy"];

export const parseMode = (
  raw: string | null,
): NonNullable<EngineOptions["mode"]> =>
  raw && (VALID_MODES as readonly string[]).includes(raw)
    ? (raw as NonNullable<EngineOptions["mode"]>)
    : "bottom";

export const parseAnimation = (
  raw: string | null,
): EngineOptions["animation"] =>
  raw && (VALID_ANIMATIONS as readonly string[]).includes(raw)
    ? (raw as EngineOptions["animation"])
    : undefined;

const VALID_DRAG_FROM: ReadonlyArray<NonNullable<EngineOptions["dragFrom"]>> = [
  "handle",
  "sheet",
  "zones",
];

export const parseDragFrom = (
  raw: string | null,
): EngineOptions["dragFrom"] =>
  raw && (VALID_DRAG_FROM as readonly string[]).includes(raw)
    ? (raw as EngineOptions["dragFrom"])
    : undefined;

export const parseList = (raw: string | null): string[] | undefined =>
  raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : undefined;

export const parseDimension = (
  raw: string | null,
): string | number | undefined => {
  if (raw === null) return undefined;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && raw.trim() !== "" ? numeric : raw;
};

const ANCHOR_POSITIONS: ReadonlyArray<AnchorPosition> = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "sheet-top-left",
  "sheet-top-center",
  "sheet-top-right",
  "dock-bottom",
  "dock-top",
];

const ANCHOR_ANIMATIONS: ReadonlyArray<AnchorAnimationPreset> = [
  "fade",
  "scale",
  "slide",
  "pop",
  "none",
];

export const parseAnchorOptions = (
  el: HTMLElement,
): Omit<AnchorOptions, "element"> => {
  const position = el.getAttribute("data-position");
  const animation = el.getAttribute("data-animation");
  const showOn = parseList(el.getAttribute("data-show-on"));
  const fadeRangeRaw = parseList(el.getAttribute("data-fade-range"));
  const fadeRange =
    fadeRangeRaw?.length === 2 &&
    fadeRangeRaw.every(v => Number.isFinite(Number(v)))
      ? ([Number(fadeRangeRaw[0]), Number(fadeRangeRaw[1])] as [number, number])
      : undefined;
  return {
    position:
      position &&
      (ANCHOR_POSITIONS as readonly string[]).includes(position)
        ? (position as AnchorPosition)
        : undefined,
    inset: el.getAttribute("data-inset") ?? undefined,
    showOn,
    fadeRange,
    interactive: el.getAttribute("data-interactive") !== "false",
    animation:
      animation &&
      (ANCHOR_ANIMATIONS as readonly string[]).includes(animation)
        ? (animation as AnchorAnimationPreset)
        : undefined,
  };
};
