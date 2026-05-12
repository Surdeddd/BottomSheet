export type ScrollCacheDeps = {
  scrollContainer: HTMLElement | undefined;
  getMaxAxisSize: () => number;
};

export type ScrollCache = {
  cache: (id: string, prevSize: number, nextSize: number) => void;
  restore: (id: string, prevSize: number, nextSize: number) => void;
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
