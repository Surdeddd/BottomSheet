import type {
  ScrimOverlayOptions,
  ScrimUpdate,
  SheetMode,
} from "../types";
import { SCRIM_PRESETS } from "../types";
import type { ResolvedSnap } from "../primitives/snap-points";
import { findById } from "../primitives/snap-points";

import {
  OPACITY_WRITE_EPSILON,
  POINTER_EVENTS_OPACITY_THRESHOLD,
  RANGE_DIVISION_EPSILON,
} from "../primitives/hot-path-thresholds";
import { WriteSentinel } from "../primitives/opacity-dedup";
import { devWarn } from "../primitives/devWarn";

const VALID_CSS_LENGTH = /^-?\d+(?:\.\d+)?(?:px|em|rem|%)$/;

export type ScrimControllerDeps = {
  mode: SheetMode;
  screenComponent: HTMLElement | undefined;
  backdrop: HTMLElement | undefined;
  isDestroyed: () => boolean;
  isTopSheet: () => boolean;
  getAllowedIds: () => string[];
  getResolvedSnaps: () => ResolvedSnap[];
  snapTo: (id: string) => void;
};

export type ScrimControllerOptions = {
  scrimMode?: "full" | "above-sheet" | "off";
  scrimColor?: string;
  scrimBlur?: string;
  scrimInteractive?: boolean;
  scrimTapToClose?: boolean;
  scrimPreset?: keyof typeof SCRIM_PRESETS;
  screenRange?: [number, number];
  backdropRange?: [number, number];
};

export class ScrimController {
  private screenComponent: HTMLElement | undefined;
  private backdrop: HTMLElement | undefined;
  private mode: SheetMode;

  private isDestroyed: () => boolean;
  private isTopSheet: () => boolean;
  private getAllowedIds: () => string[];
  private getResolvedSnaps: () => ResolvedSnap[];
  private snapToFn: (id: string) => void;

  scrimMode: "full" | "above-sheet" | "off";
  backdropRange: [number, number];
  screenRange: [number, number];

  scrimEnabled = true;
  private savedScrimRanges: {
    screen: [number, number];
    backdrop: [number, number];
  } | null = null;

  scrimTapToCloseEnabled = false;
  detachScrimTap: (() => void) | null = null;

  private scrimOverlayTeardown: (() => void) | null = null;

  private backdropOpacitySentinel = new WriteSentinel();
  private screenOpacitySentinel = new WriteSentinel();
  private lastBackdropPointer: "" | "auto" | "none" = "";
  private lastScreenDisplay: "" | "none" = "";

  invalidateOpacityCache(): void {
    this.backdropOpacitySentinel.invalidate();
    this.screenOpacitySentinel.invalidate();
  }

  constructor(deps: ScrimControllerDeps, opts: ScrimControllerOptions) {
    this.screenComponent = deps.screenComponent;
    this.backdrop = deps.backdrop;
    this.mode = deps.mode;
    this.isDestroyed = deps.isDestroyed;
    this.isTopSheet = deps.isTopSheet;
    this.getAllowedIds = deps.getAllowedIds;
    this.getResolvedSnaps = deps.getResolvedSnaps;
    this.snapToFn = deps.snapTo;

    this.scrimMode = opts.scrimMode ?? "full";
    const preset = opts.scrimPreset ? SCRIM_PRESETS[opts.scrimPreset] : null;
    this.backdropRange = opts.backdropRange ?? preset?.range ?? [0, 1];
    this.screenRange = opts.screenRange ?? preset?.range ?? [0, 1];
    this.scrimTapToCloseEnabled = opts.scrimTapToClose ?? false;

    if (this.screenComponent) {
      this.applyScrimStyles({
        color: opts.scrimColor ?? preset?.color,
        blur: opts.scrimBlur ?? preset?.blur,
        interactive:
          opts.scrimInteractive ?? preset?.interactive ?? false,
      });
      if (this.scrimMode === "above-sheet") {
        this.applyAboveSheetInset();
      } else if (this.scrimMode === "off") {
        const s = this.screenComponent.style;
        s.opacity = "0";
        s.display = "none";
        this.screenOpacitySentinel.setLastWritten(0);
        this.lastScreenDisplay = "none";
      }
    }
  }

  attach(): void {
    if (this.scrimTapToCloseEnabled) {
      this.setScrimTapToClose(true);
    }
  }

  applyOpacity(progress: number, progressChanged: boolean): void {
    if (
      !progressChanged &&
      this.backdropOpacitySentinel.value !== -1 &&
      this.screenOpacitySentinel.value !== -1
    ) {
      return;
    }
    if (this.backdrop && this.isTopSheet()) {
      const [s, e] = this.backdropRange;
      const range = Math.max(e - s, RANGE_DIVISION_EPSILON);
      const backdropOpacity = Math.min(
        Math.max((progress - s) / range, 0),
        1,
      );
      if (
        this.backdropOpacitySentinel.shouldWrite(
          backdropOpacity,
          OPACITY_WRITE_EPSILON,
        )
      ) {
        this.backdrop.style.opacity = String(backdropOpacity);
      }
      const nextPointer: "auto" | "none" =
        backdropOpacity > POINTER_EVENTS_OPACITY_THRESHOLD ? "auto" : "none";
      if (nextPointer !== this.lastBackdropPointer) {
        this.backdrop.style.pointerEvents = nextPointer;
        this.lastBackdropPointer = nextPointer;
      }
    }
    if (this.screenComponent && this.scrimMode !== "off") {
      const [ss, se] = this.screenRange;
      const screenOpacity = Math.min(
        1,
        Math.max(
          0,
          (progress - ss) / Math.max(RANGE_DIVISION_EPSILON, se - ss),
        ),
      );
      if (
        this.screenOpacitySentinel.shouldWrite(
          screenOpacity,
          OPACITY_WRITE_EPSILON,
        )
      ) {
        this.screenComponent.style.opacity = String(screenOpacity);
      }
      const nextDisplay: "" | "none" = screenOpacity > 0 ? "" : "none";
      if (nextDisplay !== this.lastScreenDisplay) {
        this.screenComponent.style.display = nextDisplay;
        this.lastScreenDisplay = nextDisplay;
      }
    }
  }

  setBackdropRange(range: [number, number], applySize: () => void): void {
    if (this.isDestroyed()) return;
    this.backdropRange = range;
    this.invalidateOpacityCache();
    applySize();
  }

  setScreenRange(range: [number, number], applySize: () => void): void {
    if (this.isDestroyed()) return;
    this.screenRange = range;
    this.invalidateOpacityCache();
    applySize();
  }

  setScrimColor(color: string | undefined | null): void {
    if (this.isDestroyed()) return;
    this.applyScrimStyles({ color: color === undefined ? null : color });
  }

  setScrimBlur(blur: string | undefined | null): void {
    if (this.isDestroyed()) return;
    this.applyScrimStyles({ blur: blur === undefined ? null : blur });
  }

  setScrimInteractive(interactive: boolean): void {
    if (this.isDestroyed()) return;
    this.applyScrimStyles({ interactive });
  }

  setScrimMode(
    mode: "full" | "above-sheet" | "off",
    applySize: () => void,
  ): void {
    if (this.isDestroyed()) return;
    if (mode === this.scrimMode) return;
    this.invalidateOpacityCache();
    const previous = this.scrimMode;
    this.scrimMode = mode;
    if (this.screenComponent) {
      const s = this.screenComponent.style;
      if (previous === "above-sheet" && mode !== "above-sheet") {
        s.position = "";
        s.inset = "";
        s.pointerEvents = "";
      }
      if (mode === "above-sheet") {
        this.applyAboveSheetInset();
      } else if (mode === "off") {
        s.opacity = "0";
        s.display = "none";
        this.screenOpacitySentinel.setLastWritten(0);
        this.lastScreenDisplay = "none";
      } else {
        if (this.lastScreenDisplay === "none") {
          s.display = "";
          this.lastScreenDisplay = "";
        }
      }
    }
    applySize();
  }

  setScrimTapToClose(enabled: boolean): void {
    if (this.isDestroyed()) return;
    if (!this.screenComponent) return;
    const installed = this.detachScrimTap !== null;
    if (enabled === installed) return;
    if (enabled) {
      const target = this.screenComponent;
      if (target.style.pointerEvents === "none") {
        target.style.pointerEvents = "auto";
      }
      const onClick = (): void => {
        if (this.isDestroyed()) return;
        const allowed = this.getAllowedIds();
        const snaps = this.getResolvedSnaps();
        const fallback = allowed.find(id => {
          const snap = findById(id, snaps);
          return snap !== null && snap.size > 0;
        });
        if (fallback) this.snapToFn(fallback);
      };
      target.addEventListener("click", onClick);
      this.detachScrimTap = () => target.removeEventListener("click", onClick);
      this.scrimTapToCloseEnabled = true;
    } else {
      this.detachScrimTap?.();
      this.detachScrimTap = null;
      this.scrimTapToCloseEnabled = false;
    }
  }

  setScrimEnabled(enabled: boolean, applySize: () => void): void {
    if (this.isDestroyed()) return;
    if (enabled === this.scrimEnabled) return;
    this.scrimEnabled = enabled;
    if (!enabled) {
      this.savedScrimRanges = {
        screen: this.screenRange,
        backdrop: this.backdropRange,
      };
      this.screenRange = [1, 1];
      this.backdropRange = [1, 1];
    } else {
      this.screenRange = this.savedScrimRanges?.screen ?? [0, 1];
      this.backdropRange = this.savedScrimRanges?.backdrop ?? [0, 1];
      this.savedScrimRanges = null;
    }
    applySize();
  }

  setScrim(opts: ScrimUpdate, applySize: () => void): void {
    if (this.isDestroyed()) return;
    if (opts.preset) {
      const cfg = SCRIM_PRESETS[opts.preset];
      this.applyScrimStyles({
        color: cfg.color,
        blur: cfg.blur ?? null,
        interactive: cfg.interactive,
      });
      this.screenRange = cfg.range;
    }
    const noop = (): void => {};
    if (opts.mode !== undefined) this.setScrimMode(opts.mode, noop);
    if (opts.enabled !== undefined) this.setScrimEnabled(opts.enabled, noop);
    if (opts.tapToClose !== undefined) this.setScrimTapToClose(opts.tapToClose);
    this.applyScrimStyles({
      color: opts.color,
      blur: opts.blur,
      interactive: opts.interactive,
    });
    if (opts.range !== undefined) {
      if (!this.scrimEnabled && this.savedScrimRanges) {
        this.savedScrimRanges = {
          screen: opts.range,
          backdrop: this.savedScrimRanges.backdrop,
        };
      } else {
        this.screenRange = opts.range;
      }
    }
    this.invalidateOpacityCache();
    applySize();
  }

  setScrimOverlay(opts: ScrimOverlayOptions): () => void {
    if (this.isDestroyed()) return () => {};
    if (!this.screenComponent) return () => {};
    this.scrimOverlayTeardown?.();

    const screen = this.screenComponent;
    const insetRaw = opts.inset ?? "16px";
    const inset = VALID_CSS_LENGTH.test(insetRaw) ? insetRaw : "16px";
    if (inset !== insetRaw) {
      devWarn(
        `[bottom-sheet] setScrimOverlay: invalid inset ${JSON.stringify(insetRaw)}; ` +
          `expected a CSS length like "16px" / "1rem" / "5%". Falling back to "16px".`,
      );
    }
    if (
      opts.children.ownerDocument &&
      opts.children.ownerDocument !== screen.ownerDocument
    ) {
      devWarn(
        "[bottom-sheet] setScrimOverlay: children belong to a different document " +
          "than the scrim. Cross-document adoption can drop event listeners; " +
          "construct children via the same document as the sheet root.",
      );
    }
    const position = opts.position ?? "top-right";
    const interactive = opts.interactive ?? true;

    const wrapper = screen.ownerDocument.createElement("div");
    wrapper.className = "bs-scrim-overlay";
    const ws = wrapper.style;
    ws.position = "absolute";
    switch (position) {
      case "top-left":
        ws.top = inset;
        ws.left = inset;
        break;
      case "top-center":
        ws.top = inset;
        ws.left = "50%";
        ws.transform = "translateX(-50%)";
        break;
      case "top-right":
        ws.top = inset;
        ws.right = inset;
        break;
      case "center-left":
        ws.top = "50%";
        ws.left = inset;
        ws.transform = "translateY(-50%)";
        break;
      case "center":
        ws.top = "50%";
        ws.left = "50%";
        ws.transform = "translate(-50%, -50%)";
        break;
      case "center-right":
        ws.top = "50%";
        ws.right = inset;
        ws.transform = "translateY(-50%)";
        break;
      case "bottom-left":
        ws.bottom = inset;
        ws.left = inset;
        break;
      case "bottom-center":
        ws.bottom = inset;
        ws.left = "50%";
        ws.transform = "translateX(-50%)";
        break;
      case "bottom-right":
        ws.bottom = inset;
        ws.right = inset;
        break;
      case "sheet-top-left":
      case "sheet-top-center":
      case "sheet-top-right":
        applySheetAnchoredPosition(
          ws,
          this.mode,
          position,
          inset,
        );
        break;
    }
    if (interactive) {
      ws.pointerEvents = "auto";
    }
    wrapper.appendChild(opts.children);
    const host = screen.parentElement;
    if (!host) {
      devWarn(
        "[bottom-sheet] setScrimOverlay: scrim element has no parent, " +
          "skipping overlay injection. Mount the sheet root before calling " +
          "setScrimOverlay.",
      );
      return () => {};
    }
    host.appendChild(wrapper);

    const teardown = (): void => {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      if (this.scrimOverlayTeardown === teardown) {
        this.scrimOverlayTeardown = null;
      }
    };
    this.scrimOverlayTeardown = teardown;
    return teardown;
  }

  destroy(): void {
    this.detachScrimTap?.();
    this.detachScrimTap = null;
    this.scrimOverlayTeardown?.();
    this.scrimOverlayTeardown = null;
    if (this.screenComponent) {
      const s = this.screenComponent.style;
      s.opacity = "";
      s.display = "";
    }
    if (this.backdrop) {
      this.backdrop.style.opacity = "";
      this.backdrop.style.pointerEvents = "";
    }
    this.invalidateOpacityCache();
    this.lastBackdropPointer = "";
    this.lastScreenDisplay = "";
  }

  private applyScrimStyles(opts: {
    color?: string | null;
    blur?: string | null;
    interactive?: boolean;
  }): void {
    if (!this.screenComponent) return;
    const s = this.screenComponent.style;
    if (opts.color !== undefined) {
      s.background = opts.color === null ? "" : opts.color;
    }
    if (opts.blur !== undefined) {
      const w = s as unknown as Record<string, string>;
      if (opts.blur === null) {
        s.backdropFilter = "";
        w.webkitBackdropFilter = "";
      } else {
        const filter = `blur(${opts.blur})`;
        s.backdropFilter = filter;
        w.webkitBackdropFilter = filter;
      }
    }
    if (opts.interactive !== undefined) {
      s.pointerEvents = opts.interactive ? "auto" : "none";
    }
  }

  private applyAboveSheetInset(): void {
    if (!this.screenComponent) return;
    const insetByMode: Record<SheetMode, string> = {
      bottom: "0 0 var(--bs-size) 0",
      top: "var(--bs-size) 0 0 0",
      left: "0 0 0 var(--bs-size)",
      right: "0 var(--bs-size) 0 0",
    };
    const s = this.screenComponent.style;
    s.position = "fixed";
    s.inset = insetByMode[this.mode];
    s.pointerEvents = "none";
  }
}

export type SheetAnchoredStyle = {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
};

export function resolveSheetAnchoredStyle(
  mode: SheetMode,
  position: "sheet-top-left" | "sheet-top-center" | "sheet-top-right",
  inset: string,
): SheetAnchoredStyle {
  const sizeOffset = `calc(var(--bs-size, 0px) + ${inset})`;
  switch (mode) {
    case "bottom":
      if (position === "sheet-top-left") return { bottom: sizeOffset, left: inset };
      if (position === "sheet-top-right") return { bottom: sizeOffset, right: inset };
      return { bottom: sizeOffset, left: "50%", transform: "translateX(-50%)" };
    case "top":
      if (position === "sheet-top-left") return { top: sizeOffset, left: inset };
      if (position === "sheet-top-right") return { top: sizeOffset, right: inset };
      return { top: sizeOffset, left: "50%", transform: "translateX(-50%)" };
    case "left":
      if (position === "sheet-top-left") return { left: sizeOffset, top: inset };
      if (position === "sheet-top-right") return { left: sizeOffset, bottom: inset };
      return { left: sizeOffset, top: "50%", transform: "translateY(-50%)" };
    case "right":
      if (position === "sheet-top-left") return { right: sizeOffset, top: inset };
      if (position === "sheet-top-right") return { right: sizeOffset, bottom: inset };
      return { right: sizeOffset, top: "50%", transform: "translateY(-50%)" };
  }
}

function applySheetAnchoredPosition(
  ws: CSSStyleDeclaration,
  mode: SheetMode,
  position: "sheet-top-left" | "sheet-top-center" | "sheet-top-right",
  inset: string,
): void {
  const style = resolveSheetAnchoredStyle(mode, position, inset);
  if (style.top !== undefined) ws.top = style.top;
  if (style.bottom !== undefined) ws.bottom = style.bottom;
  if (style.left !== undefined) ws.left = style.left;
  if (style.right !== undefined) ws.right = style.right;
  if (style.transform !== undefined) ws.transform = style.transform;
}
