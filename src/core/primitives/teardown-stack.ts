export class TeardownStack {
  private fns: Array<() => void> = [];

  add(fn: (() => void) | null | undefined): void {
    if (fn) this.fns.push(fn);
  }

  drain(): void {
    while (this.fns.length) {
      try {
        this.fns.pop()!();
      } catch (err) {
        queueMicrotask(() => {
          throw err;
        });
      }
    }
  }
}
