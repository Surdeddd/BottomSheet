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

export const sheetStack = new SheetStack();

export const __resetSheetStackForTests = (): void => {
  sheetStack.clear();
};
