export type StackEntry = {
  id: string;
  setZIndex: (z: number) => void;
  setIsTop: (isTop: boolean) => void;
  isOpen?: () => boolean;
  setDepth?: (depth: number) => void;
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

  promote(id: string): void {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return;
    if (idx !== this.entries.length - 1) {
      const [entry] = this.entries.splice(idx, 1);
      this.entries.push(entry!);
    }
    this.recompute();
  }

  update(): void {
    this.recompute();
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }

  private recompute(): void {
    let top: StackEntry | null = null;
    const open: StackEntry[] = [];
    for (const entry of this.entries) {
      if (!entry.isOpen || entry.isOpen()) {
        top = entry;
        open.push(entry);
      }
    }
    if (!top && this.entries.length > 0) {
      top = this.entries[this.entries.length - 1]!;
    }
    this.entries.forEach((entry, i) => {
      entry.setZIndex(BASE_Z + i * STEP);
      entry.setIsTop(entry === top);
      if (entry.setDepth) {
        const openIdx = open.indexOf(entry);
        entry.setDepth(openIdx === -1 ? 0 : open.length - 1 - openIdx);
      }
    });
  }
}

export const sheetStack = new SheetStack();

export const __resetSheetStackForTests = (): void => {
  sheetStack.clear();
};
