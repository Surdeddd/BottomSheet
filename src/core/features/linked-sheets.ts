export type LinkedSheet = {
  getAllowedIds(): string[];
  getResolvedSnaps(): readonly { id: string; size: number }[];
  readonly state: { activeId: string; size: number };
  snapTo(id: string): Promise<void> | void;
};

export function notifyLinkedSheets(
  sheets: readonly LinkedSheet[],
  self: object,
): void {
  if (sheets.length === 0) return;
  for (const linked of sheets) {
    if ((linked as unknown) === self) continue;
    try {
      if (linked.state.size === 0) continue;
      const ids = linked.getAllowedIds();
      const resolved = linked.getResolvedSnaps();
      const sizeOf = (id: string): number =>
        resolved.find(s => s.id === id)?.size ?? 0;
      const target = ids.find(id => sizeOf(id) > 0);
      if (target && target !== linked.state.activeId) {
        void linked.snapTo(target);
      }
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
  }
}
