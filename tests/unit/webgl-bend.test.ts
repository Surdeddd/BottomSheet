// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createBend, type Bend } from "../../src/webgl/bend";

const OUTWARD = 22;
const INWARD = 8;

const run = (
  bend: Bend,
  position: (t: number) => number,
  from: number,
  to: number,
  frame = 1000 / 60,
): number[] => {
  const out: number[] = [];
  for (let t = from; t <= to; t += frame) out.push(bend.step(position(t), t));
  return out;
};

const peak = (values: number[]): number =>
  values.reduce((max, v) => Math.max(max, Math.abs(v)), 0);

describe("the bend of the WebGL surface", () => {
  it("stays flat while the sheet stands still", () => {
    const bend = createBend({ jelly: 0.5, inward: 1 });
    bend.reset(400, 0);
    expect(peak(run(bend, () => 400, 0, 500))).toBe(0);
    expect(bend.rest()).toBe(true);
  });

  it("lets the corners trail a sheet that moves", () => {
    const bend = createBend({ jelly: 0.5, inward: 1 });
    bend.reset(600, 0);
    const up = run(bend, t => 600 - 0.8 * t, 0, 300);
    expect(up[up.length - 1]!).toBeGreaterThan(3);

    const other = createBend({ jelly: 0.5, inward: 1 });
    other.reset(200, 0);
    const down = run(other, t => 200 + 0.8 * t, 0, 300);
    expect(down[down.length - 1]!).toBeLessThan(-3);
  });

  it("comes back to flat once the sheet stops", () => {
    const bend = createBend({ jelly: 0.5, inward: 1 });
    bend.reset(600, 0);
    run(bend, t => 600 - 0.8 * t, 0, 300);
    const after = run(bend, () => 360, 300, 1300);
    expect(Math.abs(after[after.length - 1]!)).toBeLessThan(0.3);
    expect(bend.rest()).toBe(true);
  });

  it("answers a one-pixel move after a pause with a bend you cannot see", () => {
    const bend = createBend({ jelly: 0.5, inward: 1 });
    bend.reset(600, 0);
    run(bend, t => 600 - 0.8 * t, 0, 300);
    run(bend, () => 360, 300, 1300);
    const nudge = run(bend, () => 359, 1300, 1700);
    expect(peak(nudge)).toBeLessThan(1);
  });

  it("does not depend on how often it is asked", () => {
    const motion = (t: number): number => 600 - 300 * Math.sin(t / 250);
    const slow = createBend({ jelly: 0.5, inward: 1 });
    const fast = createBend({ jelly: 0.5, inward: 1 });
    slow.reset(600, 0);
    fast.reset(600, 0);
    const at60 = run(slow, motion, 0, 600, 1000 / 60);
    const at120 = run(fast, motion, 0, 600, 1000 / 120);
    expect(Math.abs(at60[at60.length - 1]! - at120[at120.length - 1]!)).toBeLessThan(
      0.6,
    );
  });

  it("never leaves its limits, and gives less room inwards than outwards", () => {
    const bend = createBend({ jelly: 1, inward: 1 });
    bend.reset(700, 0);
    const opening = run(bend, t => 700 - 5 * t, 0, 120);
    expect(Math.max(...opening)).toBeLessThanOrEqual(INWARD);
    expect(Math.max(...opening)).toBeGreaterThan(INWARD - 1);

    const other = createBend({ jelly: 1, inward: 1 });
    other.reset(100, 0);
    const closing = run(other, t => 100 + 5 * t, 0, 120);
    expect(Math.min(...closing)).toBeGreaterThanOrEqual(-OUTWARD);
    expect(Math.min(...closing)).toBeLessThan(-(OUTWARD - 2));
  });

  it("mirrors the limits for a sheet whose inside lies the other way", () => {
    const bend = createBend({ jelly: 1, inward: -1 });
    bend.reset(100, 0);
    const values = run(bend, t => 100 + 5 * t, 0, 120);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-INWARD);
  });

  it("does not kick when the sheet is moved in one step", () => {
    const bend = createBend({ jelly: 0.5, inward: 1 });
    bend.reset(600, 0);
    bend.reset(200, 16);
    expect(peak(run(bend, () => 200, 16, 400))).toBe(0);
  });

  it("is off at jelly 0", () => {
    const bend = createBend({ jelly: 0, inward: 1 });
    bend.reset(600, 0);
    expect(peak(run(bend, t => 600 - 2 * t, 0, 300))).toBe(0);
    expect(bend.rest()).toBe(true);
  });

  it("survives a long gap between two frames", () => {
    const bend = createBend({ jelly: 0.5, inward: 1 });
    bend.reset(600, 0);
    bend.step(590, 16);
    const value = bend.step(580, 5000);
    expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(value)).toBeLessThanOrEqual(OUTWARD);
  });
});
