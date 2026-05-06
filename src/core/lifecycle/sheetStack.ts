/**
 * Multi-sheet z-index orchestration.
 *
 * When you have a sheet that itself opens another sheet (e.g. menu → detail),
 * naive rendering stacks them at the same z-index and the second one is
 * obscured. The stack assigns ascending z-indices and notifies the topmost
 * sheet so it can render its backdrop while inner sheets skip theirs.
 */
export type StackEntry = {
  id: string;
  setZIndex: (z: number) => void;
  setIsTop: (isTop: boolean) => void;
};

const BASE_Z = 100;
const STEP = 10;

class SheetStack {
  private entries: StackEntry[] = [];

  push(entry: StackEntry): () => void {
    this.entries.push(entry);
    this.recompute();
    return () => this.remove(entry.id);
  }

  remove(id: string): void {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return;
    this.entries.splice(idx, 1);
    this.recompute();
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }

  private recompute(): void {
    this.entries.forEach((entry, i) => {
      entry.setZIndex(BASE_Z + i * STEP);
      entry.setIsTop(i === this.entries.length - 1);
    });
  }
}

/** Process-wide singleton so any adapter can reach the same stack. */
export const sheetStack = new SheetStack();

/**
 * Test helper: clear all entries. Singleton state would otherwise leak across
 * tests in the same vitest worker.
 */
export const __resetSheetStackForTests = (): void => {
  sheetStack.clear();
};
