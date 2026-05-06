/**
 * Per-snap-id scroll-position preservation across small↔large transitions.
 *
 * When the sheet shrinks past a "small" threshold (half of the largest snap),
 * the inner scrollContainer's `scrollTop` is captured keyed by the FROM snap
 * id. When the sheet later grows back past that threshold into a TO snap, the
 * cached scrollTop is restored — so a full→mini→full roundtrip keeps the
 * user's place in the list, and each snap remembers its own scroll position
 * independently.
 *
 * The threshold is `maxAxisSize / 2` — a heuristic that covers 50% / fit /
 * mini snaps without requiring consumers to declare which snaps are "full"
 * vs "minimized". The factory reads `maxAxisSize` lazily via `getMaxAxisSize`
 * so resize-driven recomputes are picked up automatically.
 *
 * Cache entries are consumed on restore so a subsequent shrink/grow cycle
 * captures fresh state instead of resurrecting a stale value. `clear()` is
 * called by the engine on `setSnapPoints` because the threshold is
 * geometry-dependent — an id that used to be "full" might now be "small".
 */

export type ScrollCacheDeps = {
  /** Optional inner scroll container — feature no-ops when absent. */
  scrollContainer: HTMLElement | undefined;
  /** Lazy accessor for the engine's `maxAxisSize` (recomputed on resize). */
  getMaxAxisSize: () => number;
};

export type ScrollCache = {
  /** Capture scrollTop on shrink-past-threshold transitions. */
  cache: (id: string, prevSize: number, nextSize: number) => void;
  /** Restore scrollTop on grow-past-threshold transitions; consumes the entry. */
  restore: (id: string, prevSize: number, nextSize: number) => void;
  /** Drop all cached positions — call when geometry changes. */
  clear: () => void;
};

/**
 * Build a per-instance scroll cache. Returns an object (not a teardown)
 * because the engine drives cache/restore at specific lifecycle points
 * (before/after animation in snapTo and settleAfterDrag) rather than via
 * event subscription.
 */
export function createScrollCache(deps: ScrollCacheDeps): ScrollCache {
  const positions: Map<string, number> = new Map();

  const isSmallSize = (size: number): boolean => {
    const max = deps.getMaxAxisSize();
    if (max <= 0) return false;
    return size < max / 2;
  };

  return {
    cache(fromId, prevSize, nextSize) {
      const container = deps.scrollContainer;
      if (!container) return;
      if (isSmallSize(prevSize)) return;
      if (!isSmallSize(nextSize)) return;
      positions.set(fromId, container.scrollTop);
    },
    restore(toId, prevSize, nextSize) {
      const container = deps.scrollContainer;
      if (!container) return;
      if (isSmallSize(nextSize)) return;
      if (!isSmallSize(prevSize)) return;
      const cached = positions.get(toId);
      if (cached === undefined) return;
      container.scrollTop = cached;
      positions.delete(toId);
    },
    clear() {
      positions.clear();
    },
  };
}
