/**
 * Per-frame write-dedup sentinel for numeric values written into CSSOM.
 *
 * Pattern: a hot-path setter computes `next` per frame and gates the actual
 * `style.setProperty` / `style.opacity = ...` write behind an epsilon
 * comparison against the last-written value. Sub-pixel/fractional deltas
 * during a spring's settle tail aren't visually distinguishable, so eliding
 * the write drops 30-50% of CSSOM mutations without changing perceived
 * motion.
 *
 * The `-1` initial sentinel makes the first frame's `shouldWrite` always
 * return true (any non-negative `next` value will exceed the epsilon
 * against `-1`), guaranteeing the cold-cache write happens. Setters that
 * mutate state which invalidates the cache (range/mode/enabled flips that
 * change the progress→opacity mapping) call `invalidate()` to reset the
 * sentinel back to `-1`.
 *
 * Replaces six scattered `lastXxx = -1` field literals across the engine
 * (size + progress) and ScrimController (backdrop + screen opacity). The
 * two string-typed sentinels in ScrimController (`lastBackdropPointer`,
 * `lastScreenDisplay`) use a different equality model and stay as plain
 * fields — forcing them through this primitive would require a parallel
 * `StringSentinel<T>` for marginal win.
 *
 * @internal
 */
export class WriteSentinel {
  private last = -1;

  /**
   * Returns `true` (and updates the cached value) if `next` differs from the
   * cached `last` by more than `epsilon`. Returns `false` (and leaves the
   * cache untouched) when the delta is within epsilon — caller skips the
   * CSSOM write.
   */
  shouldWrite(next: number, epsilon: number): boolean {
    if (Math.abs(next - this.last) <= epsilon) return false;
    this.last = next;
    return true;
  }

  /**
   * Force the next `shouldWrite` to pass. Resets the cache to `-1` so any
   * non-negative `next` exceeds the epsilon comparison. Called from setters
   * that mutate state under the cache (range/mode/enabled flips that change
   * the progress→opacity mapping but don't move `progress` itself).
   */
  invalidate(): void {
    this.last = -1;
  }

  /**
   * Record `value` as the last-written without performing a write. Used
   * when a setter writes a literal value through a different path (e.g.
   * `setScrimMode("off")` writes `opacity: "0"` inline) and wants future
   * `shouldWrite` calls to short-circuit against that known cached state.
   */
  setLastWritten(value: number): void {
    this.last = value;
  }

  /** Read-only accessor for diagnostic / dedup-aware peek. */
  get value(): number {
    return this.last;
  }
}
