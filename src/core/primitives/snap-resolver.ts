import {
  allowedRange,
  findById,
  findDragSettleTarget,
  resolveSnapList,
  type ResolvedSnap,
  type SettleTargetInput,
} from "./snap-points";
import type { SheetMode, SnapPointDef } from "../types";

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

    private onMaxAxisSizeChange?: (n: number) => void,
  ) {
    this.raw = raw;
    this.allowedIds = allowed ?? raw.map(p => p.id);
    this.recompute();
  }

  recompute(): void {
    this.resolved = resolveSnapList(this.raw, this.mode, this.measureFit);
    this.maxAxisSize = this.resolved.reduce(
      (m, s) => (s.size > m ? s.size : m),
      0,
    );
    this.rangeCache = null;
    this.onMaxAxisSizeChange?.(this.maxAxisSize);
  }

  setRaw(raw: SnapPointDef[]): void {
    this.raw = raw;
    this.recompute();
  }

  setAllowedIds(ids: string[]): void {
    this.allowedIds = ids;
    this.rangeCache = null;
  }

  findById(id: string): ResolvedSnap | null {
    return findById(id, this.resolved);
  }

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

  getAllowedRange(): { min: number; max: number } {
    return (
      this.rangeCache ??
      (this.rangeCache = allowedRange(this.resolved, this.allowedIds))
    );
  }

  getResolvedSnaps(): readonly ResolvedSnap[] {
    return this.resolved;
  }

  getAllowedIds(): readonly string[] {
    return this.allowedIds;
  }

  getMaxAxisSize(): number {
    return this.maxAxisSize;
  }

  setMaxAxisSize(n: number): void {
    this.maxAxisSize = n;
    this.onMaxAxisSizeChange?.(n);
  }
}
