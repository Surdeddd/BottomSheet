export type LinkedSheet = {
  getAllowedIds(): string[];
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
      const target = ids.find(id => id !== "closed");
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
