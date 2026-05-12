export class WriteSentinel {
  private last = -1;

  shouldWrite(next: number, epsilon: number): boolean {
    if (Math.abs(next - this.last) <= epsilon) return false;
    this.last = next;
    return true;
  }

  invalidate(): void {
    this.last = -1;
  }

  setLastWritten(value: number): void {
    this.last = value;
  }

  get value(): number {
    return this.last;
  }
}
