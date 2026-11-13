export type ScrollCacheDeps = {
  scrollContainer: HTMLElement | undefined;
  getMaxAxisSize: () => number;
};

export type ScrollCache = {
  leave: (fromId: string, prevSize: number, nextSize: number) => void;
  enter: (toId: string, prevSize: number, nextSize: number) => void;
  clear: () => void;
};

export function createScrollCache(deps: ScrollCacheDeps): ScrollCache {
  const positions: Map<string, number> = new Map();

  const isSmallSize = (size: number): boolean => {
    const max = deps.getMaxAxisSize();
    if (max <= 0) return false;
    return size < max / 2;
  };

  return {
    leave(fromId, prevSize, nextSize) {
      const container = deps.scrollContainer;
      if (!container) return;
      if (nextSize <= 0) {
        positions.clear();
        return;
      }
      if (isSmallSize(prevSize) || !isSmallSize(nextSize)) return;
      positions.set(fromId, container.scrollTop);
    },
    enter(toId, prevSize, nextSize) {
      const container = deps.scrollContainer;
      if (!container) return;
      if (isSmallSize(nextSize) || !isSmallSize(prevSize)) return;
      const cached = positions.get(toId);
      if (cached === undefined) return;
      positions.delete(toId);
      container.scrollTop = cached;
    },
    clear() {
      positions.clear();
    },
  };
}
