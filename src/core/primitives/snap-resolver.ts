import {
  allowedRange,
  findById,
  findDragSettleTarget,
  resolveSnapList,
  type ResolvedSnap,
  type SettleTargetInput,
} from "./snap-points";
import type { SheetMode, SnapPointDef } from "../types";

/**
 * Owns resolved-snap geometry + the `(resolvedSnaps × allowedIds) → range`
 * cache. Engine retains DOM ownership: the optional `onMaxAxisSizeChange`
 * callback fires after each `recompute()` so the engine can write
 * `element.style[layoutAxis(mode)] = ${maxAxisSize}px`.
 *
 * Free functions in `snap-points.ts` stay pure — this class wraps them with
 * cached state so engine's hot-path call sites collapse from `findById(id,
 * this.resolvedSnaps)` to `this.snaps.findById(id)` and from manual range
 * memoization to `this.snaps.getAllowedRange()`.
 *
 * State migrated from BottomSheetEngine:
 *   - snapPointsRaw, allowedIds, resolvedSnaps, maxAxisSize, allowedRangeCache
 *
 * State that STAYS on engine:
 *   - activeId (crosses into event emission, not purely geometric)
 *
 * @internal
 */
export class SnapResolver {
  private raw: SnapPointDef[];
  private allowedIds: string[];
  private resolved: ResolvedSnap[] = [];
  private maxAxisSize = 0;
  private rangeCache: { min: number; max: number } | null = null;

  constructor(
    raw: SnapPointDef[],
    allowed: string[] | undefined,
    private mode: SheetMode,
    private measureFit?: () => number,
    /**
     * Called after each `recompute()` with the new maxAxisSize so the engine
     * can apply the layout-axis style. Engine retains DOM ownership.
     */
    private onMaxAxisSizeChange?: (n: number) => void,
  ) {
    this.raw = raw;
    this.allowedIds = allowed ?? raw.map(p => p.id);
    this.recompute();
  }

  /**
   * Re-resolve raw → resolved against the current viewport / fit-measure,
   * recompute maxAxisSize, invalidate range cache, notify engine. Called on
   * resize, orientationchange, visualViewport changes, and snap-list swaps.
   */
  recompute(): void {
    this.resolved = resolveSnapList(this.raw, this.mode, this.measureFit);
    this.maxAxisSize = this.resolved.reduce(
      (m, s) => (s.size > m ? s.size : m),
      0,
    );
    this.rangeCache = null;
    this.onMaxAxisSizeChange?.(this.maxAxisSize);
  }

  /** Replace the raw snap list and recompute. Engine calls on `setSnapPoints`. */
  setRaw(raw: SnapPointDef[]): void {
    this.raw = raw;
    this.recompute();
  }

  /**
   * Replace the allow-list. Range cache depends on `(resolvedSnaps ×
   * allowedIds)` so flipping ids alone invalidates without a full recompute.
   */
  setAllowedIds(ids: string[]): void {
    this.allowedIds = ids;
    this.rangeCache = null;
  }

  findById(id: string): ResolvedSnap | null {
    return findById(id, this.resolved);
  }

  /**
   * Pure drag-settle target resolution. Engine passes the gesture-specific
   * fields (delta, velocity, pointerKind, flickVelocity, dragThreshold) plus
   * `size`/`activeId` since those are still engine-owned.
   */
  findDragSettleTarget(
    args: Omit<SettleTargetInput, "resolved" | "allowed" | "maxAxisSize">,
  ): ResolvedSnap | null {
    return findDragSettleTarget({
      ...args,
      resolved: this.resolved,
      allowed: this.allowedIds,
      maxAxisSize: this.maxAxisSize,
    });
  }

  /**
   * Memoised allowed-range query. Twice-per-drag-frame (gesture onMove +
   * applySize→computeProgress); cache collapses 2× iteration of resolvedSnaps
   * to one recompute per geometry/allow-list change.
   */
  getAllowedRange(): { min: number; max: number } {
    return (
      this.rangeCache ??
      (this.rangeCache = allowedRange(this.resolved, this.allowedIds))
    );
  }

  /**
   * Read-only view of resolved snaps. Returned as `readonly` to discourage
   * accidental mutation by feature install sites that close over this list.
   */
  getResolvedSnaps(): readonly ResolvedSnap[] {
    return this.resolved;
  }

  getAllowedIds(): readonly string[] {
    return this.allowedIds;
  }

  getMaxAxisSize(): number {
    return this.maxAxisSize;
  }

  /**
   * External clamp override. The resize-observer feature compares
   * `getMaxAxisSize()` against the live viewport and shrinks if the largest
   * resolved snap exceeds it (mobile address-bar collapse / soft-keyboard
   * window resize). The next `recompute()` overwrites this clamp from the
   * resolved-snap reduction.
   *
   * Does NOT invalidate the range cache — viewport clamping doesn't change
   * `(resolvedSnaps × allowedIds) → range`. DOES fire `onMaxAxisSizeChange`
   * so the resolver owns the layout-axis style write end-to-end (symmetric
   * with `recompute()` — feature call sites no longer duplicate the write).
   */
  setMaxAxisSize(n: number): void {
    this.maxAxisSize = n;
    this.onMaxAxisSizeChange?.(n);
  }
}
