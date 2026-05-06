export type LinkedSheet = {
  getAllowedIds(): string[];
  readonly state: { activeId: string };
  snapTo(id: string): Promise<void> | void;
};

/**
 * Ask each linked peer to shrink to its first non-zero allowed snap. The
 * `self` argument is the host engine — the same instance is filtered out
 * so a sheet linked to itself (or via a shared array including the host)
 * doesn't nudge itself.
 *
 * Skipped per-peer when:
 *   - the peer has no non-zero allowed snap (degenerate config), or
 *   - the peer is already at the target id.
 *
 * Errors thrown by a peer are isolated and re-thrown asynchronously so a
 * destroyed / mid-transition peer can't cascade into the host's open path.
 *
 * Pure function — no subscriptions, no state. Engine calls this at the
 * exact moment of the closed→open transition (matching the prior inline
 * implementation), preserving the engine's existing event ordering.
 */
export function notifyLinkedSheets(
  sheets: readonly LinkedSheet[],
  self: object,
): void {
  if (sheets.length === 0) return;
  for (const linked of sheets) {
    if ((linked as unknown) === self) continue;
    try {
      const ids = linked.getAllowedIds();
      const target = ids.find(id => id !== "closed");
      if (target && target !== linked.state.activeId) {
        void linked.snapTo(target);
      }
    } catch (err) {
      // Linked sheet may be destroyed / mid-transition / otherwise broken;
      // surface the error async so it doesn't perturb THIS sheet's open
      // path. queueMicrotask preserves the original stack.
      queueMicrotask(() => {
        throw err;
      });
    }
  }
}
