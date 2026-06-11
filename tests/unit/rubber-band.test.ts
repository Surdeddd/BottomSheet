import { describe, expect, it } from "vitest";
import { rubberBand } from "../../src/core/primitives/rubber-band";

describe("rubberBand", () => {
  it("returns 0 for zero overshoot", () => {
    expect(rubberBand(0, 600)).toBe(0);
  });

  it("is strictly monotonic: more overdrag always moves the sheet further", () => {
    let prev = 0;
    for (let o = 1; o <= 500; o += 1) {
      const d = rubberBand(o, 600);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });

  it("never amplifies the finger near zero", () => {
    for (const o of [0.1, 0.5, 1, 2, 5]) {
      expect(rubberBand(o, 600)).toBeLessThanOrEqual(o);
    }
  });

  it("stays below the cap asymptote", () => {
    const cap = Math.min(600 * 0.15, 80);
    for (const o of [10, 50, 100, 1000, 100000]) {
      expect(rubberBand(o, 600)).toBeLessThan(cap);
    }
  });

  it("is odd-symmetric for negative overshoot", () => {
    for (const o of [1, 13, 80, 300]) {
      expect(rubberBand(-o, 600)).toBeCloseTo(-rubberBand(o, 600), 10);
    }
  });

  it("scales the cap down for small axes", () => {
    expect(rubberBand(10000, 100)).toBeLessThan(15);
  });

  it("returns 0 when the axis size is 0", () => {
    expect(rubberBand(50, 0)).toBe(0);
  });
});
