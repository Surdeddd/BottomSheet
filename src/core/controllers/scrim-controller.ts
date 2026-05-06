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

/**
 * Engine-side dependencies the controller needs to drive scrim behaviour.
 * Passed once at construction; the controller never reads engine state
 * directly so the boundary stays clean.
 */
export type ScrimControllerDeps = {
  /** Sheet mode (fixed for the engine's lifetime) — drives `above-sheet` inset map. */
  mode: SheetMode;
  /** DOM refs the engine owns. Either may be undefined; controller no-ops accordingly. */
  screenComponent: HTMLElement | undefined;
  backdrop: HTMLElement | undefined;
  /** Engine destroyed flag — every public setter early-returns when true. */
  isDestroyed: () => boolean;
  /** Whether THIS engine is the topmost in the sheet stack — gates backdrop writes. */
  isTopSheet: () => boolean;
  /** Live allow-list — tap-to-close picks the first allowed non-zero snap. */
  getAllowedIds: () => string[];
  /** Resolved snap geometry — tap-to-close needs sizes to skip closed snaps. */
  getResolvedSnaps: () => ResolvedSnap[];
  /** Drive the engine — tap-to-close uses the public snapTo path. */
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

/**
 * Owns the dim layer behind / around the bottom sheet — runtime-mutable state
 * for `screenComponent` (the "scrim") and `backdrop`. Extracted from
 * `BottomSheetEngine` to keep scrim concerns colocated and the engine class
 * focused on snap math + lifecycle. Public surface mirrors what the engine
 * forwards (engine setters become thin delegators).
 *
 * @internal
 */
export class ScrimController {
  // ── DOM refs (mirror engine's; cached for hot path) ─────────────────
  private screenComponent: HTMLElement | undefined;
  private backdrop: HTMLElement | undefined;
  private mode: SheetMode;

  // ── Engine callbacks ────────────────────────────────────────────────
  private isDestroyed: () => boolean;
  private isTopSheet: () => boolean;
  private getAllowedIds: () => string[];
  private getResolvedSnaps: () => ResolvedSnap[];
  private snapToFn: (id: string) => void;

  // ── Mode + state ────────────────────────────────────────────────────
  scrimMode: "full" | "above-sheet" | "off";
  backdropRange: [number, number];
  screenRange: [number, number];

  // setScrimEnabled toggle — gated through `scrimEnabled` rather than nuking
  // ranges so re-enable can restore prior values without a remount. Public
  // so tests / introspection can read it without an `as any` cast.
  scrimEnabled = true;
  private savedScrimRanges: {
    screen: [number, number];
    backdrop: [number, number];
  } | null = null;

  // ── Tap-to-close ────────────────────────────────────────────────────
  scrimTapToCloseEnabled = false;
  detachScrimTap: (() => void) | null = null;

  // ── Scrim overlay slot (positioned floating element) ────────────────
  private scrimOverlayTeardown: (() => void) | null = null;

  // ── Hot-path opacity dedup caches (per-frame writes) ────────────────
  // Numeric sentinels migrated to WriteSentinel primitive — single
  // invalidation surface, shared with the engine's size/progress sentinels.
  // The two string-typed sentinels (`Pointer`, `Display`) keep their inline
  // pattern: equality on string union, no epsilon, different reset semantics.
  private backdropOpacitySentinel = new WriteSentinel();
  private screenOpacitySentinel = new WriteSentinel();
  private lastBackdropPointer: "" | "auto" | "none" = "";
  private lastScreenDisplay: "" | "none" = "";

  /**
   * Invalidate the opacity dedup caches. Called from any setter that mutates
   * range/mode/enabled — opacity is a pure function of (progress, range,
   * enabled), so a config change makes the cached values stale even if
   * `progress` itself didn't move. Next `applyOpacity(progress, false)` call
   * sees the -1 sentinel and re-runs the math instead of short-circuiting.
   *
   * Public for the engine: `setSnapPoints` mutates resolved geometry which
   * shifts `progress→opacity` mapping under the cache; engine calls this to
   * keep the next render frame correct on a static sheet.
   * @internal
   */
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
    // Preset baselines first; explicit fields override below.
    const preset = opts.scrimPreset ? SCRIM_PRESETS[opts.scrimPreset] : null;
    this.backdropRange = opts.backdropRange ?? preset?.range ?? [0, 1];
    this.screenRange = opts.screenRange ?? preset?.range ?? [0, 1];
    this.scrimTapToCloseEnabled = opts.scrimTapToClose ?? false;

    if (this.screenComponent) {
      // Single applyScrimStyles call with explicit-wins resolution. Saves one
      // CSSOM-write batch on construction vs the prior preset-then-override
      // two-call approach. Resolution rules:
      // - color/blur: explicit `opts.scrim*` wins; falls back to preset; `??`
      //   keeps `undefined` → "skip the write" semantic, so consumers who
      //   neither set nor pick a preset retain their existing CSS.
      // - interactive: explicit wins; preset value next; default `false` so
      //   the constructor ALWAYS writes pointer-events (preserves the prior
      //   "scrimInteractive undefined → 'none'" behaviour).
      this.applyScrimStyles({
        color: opts.scrimColor ?? preset?.color,
        blur: opts.scrimBlur ?? preset?.blur,
        interactive:
          opts.scrimInteractive ?? preset?.interactive ?? false,
      });
      // Initial layout for "above-sheet" mode — same writes as setScrimMode.
      if (this.scrimMode === "above-sheet") {
        this.applyAboveSheetInset();
      } else if (this.scrimMode === "off") {
        // Force-hide on construction so frame 0 is consistent with runtime
        // setScrimMode("off"). The applyOpacity short-circuit below skips
        // the screen branch when mode === "off".
        const s = this.screenComponent.style;
        s.opacity = "0";
        s.display = "none";
        // setLastWritten records "0 was written" without going through the
        // gate, so a later applyOpacity that computes 0 from `progress` won't
        // double-write. invalidate() would force the next write — wrong here.
        this.screenOpacitySentinel.setLastWritten(0);
        this.lastScreenDisplay = "none";
      }
    }
  }

  /** Engine calls this when its `attach()` runs — installs scrim-tap-click if requested. */
  attach(): void {
    if (this.scrimTapToCloseEnabled) {
      this.setScrimTapToClose(true);
    }
  }

  // ── Hot-path: opacity computation called per-frame from engine.applySize ──

  /**
   * Per-frame opacity writer. Computes backdrop + screen opacity from the
   * sheet's progress (0..1 within allowed range), gated by sub-pixel dedup
   * caches so steady-state frames don't trigger style recalc.
   *
   * `progressChanged` is the engine's already-computed dedup gate — when
   * `false`, opacity is by construction a pure function of `progress` so
   * cached values are still valid; we short-circuit the Math.min/max +
   * division work entirely. Setters that mutate ranges/mode/enabled
   * invalidate the cache by writing -1 sentinels so the next call re-runs
   * the math.
   */
  applyOpacity(progress: number, progressChanged: boolean): void {
    // Short-circuit: opacity is a pure function of `progress` + state set by
    // setters, all of which invalidate the cache by resetting -1 sentinels.
    // The -1 guard handles first-frame ever (cache cold) — without it we'd
    // skip the initial CSSOM write.
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

  // ── Public setters (engine forwards these 1:1) ─────────────────────

  /**
   * Replace the [start, end] progress window in which the backdrop fades 0→1.
   * @param range - Tuple of two progress values in 0..1 (start <= end).
   * @param applySize - Engine-supplied recompute hook; runs one applyOpacity pass.
   * @example
   *   // Backdrop only starts darkening after the sheet crosses 30% open.
   *   engine.setBackdropRange([0.3, 1]);
   */
  setBackdropRange(range: [number, number], applySize: () => void): void {
    if (this.isDestroyed()) return;
    this.backdropRange = range;
    // Range change → cached opacity values are stale (opacity is a pure
    // function of progress AND range). Invalidate so the next applyOpacity
    // re-runs the math even if `progress` itself didn't move.
    this.invalidateOpacityCache();
    applySize();
  }

  /**
   * Replace the [start, end] progress window in which the screen scrim fades 0→1.
   * @param range - Tuple of two progress values in 0..1 (start <= end).
   * @param applySize - Engine-supplied recompute hook; runs one applyOpacity pass.
   * @example
   *   // Scrim is fully opaque only when the sheet is past 50% — softer feel.
   *   engine.setScreenRange([0, 0.5]);
   */
  setScreenRange(range: [number, number], applySize: () => void): void {
    if (this.isDestroyed()) return;
    this.screenRange = range;
    // Range mutation invalidates cached opacity values — without this, a
    // setScreenRange call on a STATIC sheet (no movement) would short-circuit
    // applyOpacity's progressChanged check and leave the old opacity stuck.
    // Mirrors the symmetric setBackdropRange invalidation.
    this.invalidateOpacityCache();
    applySize();
  }

  /**
   * Set the scrim background color. Pass `null`/`undefined` to clear the
   * inline write and let consumer CSS take over.
   * @param color - Any valid CSS color string, or `null`/`undefined` to clear.
   * @example
   *   engine.setScrimColor("rgba(0, 0, 0, 0.6)");
   *   engine.setScrimColor(null); // hand back to consumer CSS
   */
  setScrimColor(color: string | undefined | null): void {
    if (this.isDestroyed()) return;
    this.applyScrimStyles({ color: color === undefined ? null : color });
  }

  /**
   * Set the scrim backdrop-filter blur radius. Pass `null`/`undefined` to clear.
   * @param blur - CSS length (e.g. `"8px"`) consumed as `blur(<value>)`, or
   *               `null`/`undefined` to remove the filter.
   * @example
   *   engine.setScrimBlur("12px"); // frosted-glass effect
   *   engine.setScrimBlur(null);    // disable blur
   */
  setScrimBlur(blur: string | undefined | null): void {
    if (this.isDestroyed()) return;
    this.applyScrimStyles({ blur: blur === undefined ? null : blur });
  }

  /**
   * Toggle whether the scrim layer captures pointer events.
   * @param interactive - `true` → `pointer-events: auto`; `false` → `none`.
   * @example
   *   engine.setScrimInteractive(true);  // scrim swallows clicks
   *   engine.setScrimInteractive(false); // clicks pass through to content below
   */
  setScrimInteractive(interactive: boolean): void {
    if (this.isDestroyed()) return;
    this.applyScrimStyles({ interactive });
  }

  /**
   * Switch scrim positioning at runtime.
   * @param mode - `"full"` (consumer CSS), `"above-sheet"` (engine-pinned inset
   *               so only the area NOT covered by the sheet is dimmed), or
   *               `"off"` (display:none + opacity:0 — no remount needed).
   * @param applySize - Engine-supplied recompute hook; runs one applyOpacity pass.
   * @example
   *   engine.setScrimMode("above-sheet"); // dim only the area above the sheet
   *   engine.setScrimMode("off");          // disable scrim layer
   */
  setScrimMode(
    mode: "full" | "above-sheet" | "off",
    applySize: () => void,
  ): void {
    if (this.isDestroyed()) return;
    if (mode === this.scrimMode) return;
    // Mode change invalidates the dedup cache — the "off" branch below
    // forces screenOpacitySentinel=0 which would otherwise let a later "full"
    // transition short-circuit applyOpacity (with progressChanged=false on a
    // static sheet) and keep the screen at opacity:0 forever.
    this.invalidateOpacityCache();
    const previous = this.scrimMode;
    this.scrimMode = mode;
    if (this.screenComponent) {
      const s = this.screenComponent.style;
      // Clear the inline layout writes from the prior mode whenever we leave
      // "above-sheet" — consumers may want to restyle from scratch.
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
        // setLastWritten records "0 was written" without going through the
        // gate, so a later applyOpacity that computes 0 from `progress` won't
        // double-write. invalidate() would force the next write — wrong here.
        this.screenOpacitySentinel.setLastWritten(0);
        this.lastScreenDisplay = "none";
      } else {
        // mode === "full": ensure prior "off"-path writes are released so
        // applyOpacity takes over again.
        if (this.lastScreenDisplay === "none") {
          s.display = "";
          this.lastScreenDisplay = "";
        }
      }
    }
    applySize();
  }

  /**
   * Enable or disable click-on-scrim → snap to first non-zero allowed snap.
   * Auto-promotes `pointer-events: auto` when scrim is non-interactive so the
   * click listener actually fires.
   * @param enabled - `true` installs the click listener; `false` removes it.
   * @example
   *   engine.setScrimTapToClose(true);  // tap outside sheet collapses it
   *   engine.setScrimTapToClose(false); // require explicit close button
   */
  setScrimTapToClose(enabled: boolean): void {
    if (this.isDestroyed()) return;
    if (!this.screenComponent) return;
    // `detachScrimTap` doubles as the install flag — idempotency.
    const installed = this.detachScrimTap !== null;
    if (enabled === installed) return;
    if (enabled) {
      const target = this.screenComponent;
      // Auto-promote pointer-events when scrim is non-interactive — otherwise
      // the click listener would never fire. Mirrors constructor's DTRT.
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

  /**
   * Toggle the scrim layer without remounting. Disabling stashes current
   * `screenRange`/`backdropRange` and degenerates them to `[1, 1]` (opacity
   * formula → 0 across the whole range); re-enabling restores the saved values.
   * @param enabled - `false` hides scrim, `true` restores prior ranges.
   * @param applySize - Engine-supplied recompute hook; runs one applyOpacity pass.
   * @example
   *   engine.setScrimEnabled(false); // hide scrim, ranges remembered
   *   engine.setScrimEnabled(true);  // restore prior ranges (no remount)
   */
  setScrimEnabled(enabled: boolean, applySize: () => void): void {
    if (this.isDestroyed()) return;
    if (enabled === this.scrimEnabled) return;
    this.scrimEnabled = enabled;
    if (!enabled) {
      // Stash tuple refs (not deep clone) — one allocation per disable/enable
      // pair, not per frame.
      this.savedScrimRanges = {
        screen: this.screenRange,
        backdrop: this.backdropRange,
      };
      // [1, 1] degenerates the opacity formula to 0 across the whole range.
      this.screenRange = [1, 1];
      this.backdropRange = [1, 1];
    } else {
      this.screenRange = this.savedScrimRanges?.screen ?? [0, 1];
      this.backdropRange = this.savedScrimRanges?.backdrop ?? [0, 1];
      this.savedScrimRanges = null;
    }
    applySize();
  }

  /**
   * Batch-update multiple scrim fields with a single applySize() at the end.
   * If `preset` is set, it seeds color/blur/interactive/range first; explicit
   * fields override.
   * @param opts - Partial scrim config: preset, mode, enabled, tapToClose,
   *               color, blur, interactive, range.
   * @param applySize - Engine-supplied recompute hook; runs ONCE per call.
   * @example
   *   engine.setScrim({
   *     preset: "frosted",
   *     mode: "above-sheet",
   *     tapToClose: true,
   *   });
   */
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
    // Pass a no-op to inner setters so their `applySize()` calls are skipped —
    // we run ONE recompute at the end of the batch to honour the engine's
    // documented "ONE applySize per setScrim()" contract. Prior implementation
    // could trigger up to 3 redundant frames when mode + enabled + range all
    // changed in one batch.
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
      this.screenRange = opts.range;
    }
    // Final invalidation before the single batch applySize. Inline assignments
    // above (preset.range at line 463, opts.range at line 480, applyScrimStyles
    // for color/blur/interactive) all bypass the per-setter invalidate path,
    // so without this line a setScrim({range: [0, 0.5]}) on a static sheet
    // would short-circuit the next applyOpacity and leave stale opacity.
    this.invalidateOpacityCache();
    applySize();
  }

  /**
   * Inject a positioned floating element into the scrim layer (e.g. a close
   * button anchored top-right). Replaces any prior overlay so repeated calls
   * (reactive effects re-running) don't accumulate wrappers.
   * @param opts - Children element, optional `inset` (default `"16px"`),
   *               `position` (9-way grid, default `"top-right"`), and
   *               `interactive` flag (default `true`).
   * @returns Teardown function that removes the wrapper from the DOM.
   * @example
   *   const teardown = engine.setScrimOverlay({
   *     children: closeBtn,
   *     position: "top-right",
   *     inset: "20px",
   *   });
   *   // later: teardown(); // remove the floating button
   */
  setScrimOverlay(opts: ScrimOverlayOptions): () => void {
    if (this.isDestroyed()) return () => {};
    if (!this.screenComponent) return () => {};
    // Replace any prior overlay so consumers can call repeatedly without
    // accumulating wrappers (e.g. a reactive component re-running effects).
    this.scrimOverlayTeardown?.();

    const screen = this.screenComponent;
    const inset = opts.inset ?? "16px";
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
    }
    if (interactive) {
      ws.pointerEvents = "auto";
    }
    wrapper.appendChild(opts.children);
    screen.appendChild(wrapper);

    const teardown = (): void => {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      if (this.scrimOverlayTeardown === teardown) {
        this.scrimOverlayTeardown = null;
      }
    };
    this.scrimOverlayTeardown = teardown;
    return teardown;
  }

  /** Tear down toggle-state listeners + remove any injected overlay wrapper. */
  destroy(): void {
    this.detachScrimTap?.();
    this.detachScrimTap = null;
    this.scrimOverlayTeardown?.();
    this.scrimOverlayTeardown = null;
    // Clear inline writes on screenComponent + backdrop so a subsequent
    // remount (rare — e.g. in tests) doesn't inherit stale opacity.
    if (this.screenComponent) {
      const s = this.screenComponent.style;
      s.opacity = "";
      s.display = "";
    }
    if (this.backdrop) {
      this.backdrop.style.opacity = "";
      this.backdrop.style.pointerEvents = "";
    }
    // Reset hot-path dedup sentinels so the next applyOpacity call writes
    // unconditionally (mirrors engine's lastSizeWritten / lastProgressWritten
    // reset on destroy). Keeps semantics symmetric for any future reuse.
    this.invalidateOpacityCache();
    this.lastBackdropPointer = "";
    this.lastScreenDisplay = "";
  }

  // ── Private helpers ────────────────────────────────────────────────

  /** Centralized scrim style writer — atomic 3-property write across all setters. */
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
      // Safari < 18 still needs the prefixed property; assigning via a generic
      // record cast avoids a TS lib-dom miss for the camelCase variant.
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

  /** Pin the screen overlay to the area NOT occupied by the sheet. */
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
